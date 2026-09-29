/* eslint-disable no-console */
import './quiet';
import 'reflect-metadata';
import 'dotenv/config';
import {
  addDays,
  addMinutes,
  isAfter,
  isBefore,
  startOfDay,
  subDays,
  subHours,
} from 'date-fns';

import dataSource from '@shared/infra/typeorm/dataSource';
import RecurringTimeBlock from '@modules/appointments/infra/typeorm/entities/RecurringTimeBlock';
import expandRecurringBlocks from '@modules/appointments/utils/expandRecurringBlocks';
import workWindow from '@modules/appointments/utils/workWindow';

// Simulação de agendamentos para testar a agenda e o faturamento no banco
// local. Cria clientes fictícios (e-mail @simulacao.gobarber.test) e
// agendamentos dos últimos dias e das próximas semanas, respeitando o
// expediente, os bloqueios e o intervalo entre atendimentos.
//
//   yarn simular            apaga a simulação anterior e cria outra
//   yarn simular --limpar   só apaga o que a simulação criou
//
// Nada que não seja da simulação é alterado.

const SIMULATION_DOMAIN = '@simulacao.gobarber.test';
const PAST_DAYS = 60;
const FUTURE_DAYS = 14;

const CLIENT_NAMES = [
  'Rafael Souza',
  'Bruno Lima',
  'Diego Martins',
  'Felipe Rocha',
  'Gustavo Alves',
  'Henrique Costa',
  'Igor Pereira',
  'Leonardo Dias',
  'Marcelo Ribeiro',
  'Matheus Carvalho',
  'Nicolas Barbosa',
  'Otávio Mendes',
  'Paulo Teixeira',
  'Renan Fernandes',
  'Samuel Araújo',
  'Thiago Gomes',
  'Vinícius Moreira',
  'William Cardoso',
  'André Nunes',
  'Caio Freitas',
  'Daniel Castro',
  'Eduardo Pinto',
  'Fábio Ramos',
  'Gabriel Duarte',
  'Lucas Azevedo',
];

interface IPeriod {
  start: Date;
  end: Date;
}

const overlaps = (a: IPeriod, b: IPeriod): boolean =>
  isBefore(a.start, b.end) && isAfter(a.end, b.start);

// Aleatório previsível: a mesma simulação a cada execução
let seed = 20260929;
function random(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

async function clean(): Promise<number> {
  const clients: Array<{ id: string }> = await dataSource.query(
    'SELECT id FROM clients WHERE email LIKE $1',
    [`%${SIMULATION_DOMAIN}`],
  );

  if (clients.length === 0) return 0;

  const ids = clients.map(client => client.id);
  const [{ count }] = await dataSource.query(
    'SELECT count(*) FROM appointments WHERE client_id = ANY($1)',
    [ids],
  );

  await dataSource.query('DELETE FROM appointments WHERE client_id = ANY($1)', [
    ids,
  ]);

  await dataSource.query('DELETE FROM clients WHERE id = ANY($1)', [ids]);

  return Number(count);
}

async function simulate(): Promise<void> {
  const now = new Date();
  const first = startOfDay(subDays(now, PAST_DAYS));
  const last = startOfDay(addDays(now, FUTURE_DAYS));

  const [providers, schedules, services, settings] = await Promise.all([
    dataSource.query('SELECT id, name FROM users WHERE active ORDER BY name'),
    dataSource.query(
      'SELECT provider_id, day_of_week, start_time, end_time FROM provider_schedules',
    ),
    dataSource.query(
      'SELECT id, name, duration_minutes, price_cents FROM services WHERE active',
    ),
    dataSource.query(
      "SELECT value FROM settings WHERE key = 'appointment_buffer_minutes'",
    ),
  ]);
  const bufferMinutes = settings[0] ? Number(settings[0].value) : 0;

  if (services.length === 0) {
    throw new Error('Cadastre pelo menos um serviço ativo antes de simular.');
  }

  // Clientes fictícios, num INSERT só
  const clientValues = CLIENT_NAMES.map((name, index) => [
    name,
    `${name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '.')}${SIMULATION_DOMAIN}`,
    `119${String(80000000 + index * 13579).padStart(8, '0')}`,
  ]);
  const insertedClients: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO clients (name, email, phone) VALUES ${clientValues
      .map(
        (_, index) =>
          `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
      )
      .join(', ')} RETURNING id`,
    clientValues.flat(),
  );
  const clientIds = insertedClients.map(client => client.id);

  // Ocupado: agendamentos reais ativos e bloqueios (avulsos e que repetem)
  const [appointments, blocks, rules] = await Promise.all([
    dataSource.query(
      'SELECT provider_id, date, blocked_until FROM appointments WHERE canceled_at IS NULL AND date BETWEEN $1 AND $2',
      [first, addDays(last, 1)],
    ),
    dataSource.query(
      'SELECT provider_id, start_date, end_date FROM time_blocks WHERE start_date < $2 AND end_date > $1',
      [first, addDays(last, 1)],
    ),
    dataSource.getRepository(RecurringTimeBlock).find(),
  ]);

  const busy = new Map<string, IPeriod[]>();
  const blocked = new Map<string, IPeriod[]>();
  const push = (map: Map<string, IPeriod[]>, id: string, period: IPeriod) =>
    map.set(id, [...(map.get(id) || []), period]);

  appointments.forEach(
    (item: { provider_id: string; date: Date; blocked_until: Date }) =>
      push(busy, item.provider_id, {
        start: item.date,
        end: item.blocked_until,
      }),
  );
  blocks.forEach(
    (item: { provider_id: string; start_date: Date; end_date: Date }) =>
      push(blocked, item.provider_id, {
        start: item.start_date,
        end: item.end_date,
      }),
  );
  expandRecurringBlocks(rules, first, addDays(last, 1)).forEach(period =>
    push(blocked, period.provider_id, {
      start: period.start_date,
      end: period.end_date,
    }),
  );

  const rows: unknown[][] = [];
  const counts = {
    completed: 0,
    no_show: 0,
    pending: 0,
    canceled: 0,
    future: 0,
  };

  for (let day = first; !isAfter(day, last); day = addDays(day, 1)) {
    const daysAgo = Math.round(
      (startOfDay(now).getTime() - day.getTime()) / 86400000,
    );
    // Agenda mais cheia no passado; as próximas semanas ainda enchendo
    const occupancy =
      daysAgo >= 0 ? 0.6 : Math.max(0.15, 0.5 + daysAgo * 0.025);

    providers.forEach((provider: { id: string }) => {
      const schedule = schedules.find(
        (item: { provider_id: string; day_of_week: number }) =>
          item.provider_id === provider.id && item.day_of_week === day.getDay(),
      );

      if (!schedule) return;

      const { workStart, workEnd } = workWindow(day, schedule);
      let start = workStart;

      while (isBefore(start, workEnd)) {
        const service = pick(services) as {
          id: string;
          duration_minutes: number;
          price_cents: number;
        };
        const end = addMinutes(start, service.duration_minutes);
        const blockedUntil = addMinutes(end, bufferMinutes);
        const slot = { start, end: blockedUntil };
        // O atendimento em si (sem o intervalo) não pode cair num bloqueio
        const servicePeriod = { start, end };

        const fits =
          !isAfter(end, workEnd) &&
          !(busy.get(provider.id) || []).some(period =>
            overlaps(slot, period),
          ) &&
          !(blocked.get(provider.id) || []).some(period =>
            overlaps(servicePeriod, period),
          );

        if (!fits || random() > occupancy) {
          start = addMinutes(start, 30);
          // eslint-disable-next-line no-continue
          continue;
        }

        const started = !isBefore(now, start);
        let attendance: string | null = null;
        let canceledAt: Date | null = null;
        let canceledBy: string | null = null;
        const roll = random();

        if (roll < 0.06) {
          // Cancelado com antecedência (não ocupa o horário)
          canceledAt = subHours(start, 2 + Math.floor(random() * 48));
          if (isAfter(canceledAt, now)) canceledAt = subHours(now, 1);
          canceledBy = random() < 0.5 ? 'client' : 'provider';
          counts.canceled += 1;
        } else if (!started) {
          counts.future += 1;
        } else if (daysAgo <= 2 && random() < 0.5) {
          // Últimos dias: parte ainda sem registro ("a confirmar")
          counts.pending += 1;
        } else if (roll < 0.14) {
          attendance = 'no_show';
          counts.no_show += 1;
        } else {
          attendance = 'completed';
          counts.completed += 1;
        }

        // Pix é o mais comum; parte em cartão e em dinheiro
        const paymentMethod = (): string => {
          const pay = random();

          if (pay < 0.45) return 'pix';
          if (pay < 0.65) return 'credit';
          if (pay < 0.8) return 'debit';

          return 'cash';
        };
        const createdAt = subDays(start, 1 + Math.floor(random() * 10));

        rows.push([
          provider.id,
          pick(clientIds),
          service.id,
          service.price_cents,
          start,
          end,
          blockedUntil,
          canceledAt,
          canceledBy,
          attendance,
          attendance ? addMinutes(end, 5) : null,
          attendance ? provider.id : null,
          attendance === 'completed' ? paymentMethod() : null,
          isAfter(createdAt, now) ? now : createdAt,
        ]);

        if (!canceledAt) push(busy, provider.id, slot);
        start = blockedUntil;
      }
    });
  }

  const COLUMNS = 14;
  const BATCH = 200;
  const batches = Array.from(
    { length: Math.ceil(rows.length / BATCH) },
    (_, index) => rows.slice(index * BATCH, (index + 1) * BATCH),
  );

  await dataSource.transaction(manager =>
    batches.reduce(
      (previous, batch) =>
        previous.then(() =>
          manager.query(
            `INSERT INTO appointments (provider_id, client_id, service_id, price_cents, date, end_date, blocked_until, canceled_at, canceled_by, attendance, attendance_at, attendance_by, payment_method, created_at) VALUES ${batch
              .map(
                (_, row) =>
                  `(${Array.from(
                    { length: COLUMNS },
                    (__, column) => `$${row * COLUMNS + column + 1}`,
                  ).join(', ')})`,
              )
              .join(', ')}`,
            batch.flat(),
          ),
        ),
      Promise.resolve(),
    ),
  );

  console.log(
    `Simulação criada: ${rows.length} agendamentos (${counts.completed} atendidos, ${counts.no_show} faltas, ${counts.pending} a confirmar, ${counts.future} futuros, ${counts.canceled} cancelados) para ${clientIds.length} clientes fictícios.`,
  );
}

async function run(): Promise<void> {
  await dataSource.initialize();

  try {
    const removed = await clean();

    if (removed > 0) {
      console.log(`Simulação anterior apagada: ${removed} agendamentos.`);
    }

    if (!process.argv.includes('--limpar')) {
      await simulate();
    }
  } finally {
    await dataSource.destroy();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
