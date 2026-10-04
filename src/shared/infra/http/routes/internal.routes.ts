import { Router, Request, Response } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';
import { container } from 'tsyringe';
import { subDays } from 'date-fns';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';

import dataSource from '@shared/infra/typeorm/dataSource';
import { runWithTenant } from '@shared/tenancy/TenantContext';
import { tenantHost } from '@shared/tenancy/hosts';
import TenantsService from '@modules/tenants/services/TenantsService';
import { SEGMENTS, SEGMENT_KEYS } from '@modules/tenants/segments';
import ResolveTenantService from '@modules/tenants/services/ResolveTenantService';
import Tenant from '@modules/tenants/infra/typeorm/entities/Tenant';
import {
  exportTenant,
  importTenant,
} from '@modules/tenants/infra/backup/tenantBackup';
import ensureMetricsToken from '../middlewares/ensureMetricsToken';

// Rotas da plataforma, usadas pelo painel do SaaS: cadastro das barbearias
// e o uso de cada uma. Ficam fora de qualquer barbearia
const internalRouter = Router();

// O proxy (Caddy) pergunta antes de emitir o certificado HTTPS de um
// endereço: só os das barbearias cadastradas. Sem token (o Caddy não manda)
// e sem revelar nada além de sim/não
internalRouter.get(
  '/domains/check',
  async (request: Request, response: Response) => {
    const domain = String(request.query.domain || '');
    const tenant = await container
      .resolve(ResolveTenantService)
      .execute(domain);

    return response.status(tenant ? 200 : 404).end();
  },
);

internalRouter.use(ensureMetricsToken);

function present(tenant: Tenant): Tenant & { host: string } {
  return { ...tenant, host: tenantHost(tenant) };
}

const idParam = celebrate({
  [Segments.PARAMS]: { id: Joi.string().uuid().required() },
});

// Ramos de negócio para escolher ao criar
internalRouter.get('/segments', (request: Request, response: Response) =>
  response.json(
    SEGMENT_KEYS.map(key => ({
      key,
      name: SEGMENTS[key].name,
      vocabulary: SEGMENTS[key].vocabulary,
    })),
  ),
);

internalRouter.get('/tenants', async (request: Request, response: Response) => {
  const tenants = await container.resolve(TenantsService).list();

  return response.json(tenants.map(present));
});

internalRouter.post(
  '/tenants',
  celebrate({
    [Segments.BODY]: {
      slug: Joi.string().max(40).required(),
      name: Joi.string().trim().max(80).required(),
      custom_domain: Joi.string().max(253).allow(null, ''),
      segment: Joi.string().valid(...SEGMENT_KEYS),
      admin: Joi.object({
        name: Joi.string().trim().max(80).allow(''),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).max(72).required(),
      }).required(),
    },
  }),
  async (request: Request, response: Response) => {
    const tenant = await container.resolve(TenantsService).create(request.body);

    return response.status(201).json(present(tenant));
  },
);

internalRouter.get(
  '/tenants/:id',
  idParam,
  async (request: Request, response: Response) => {
    const tenant = await container
      .resolve(TenantsService)
      .show(request.params.id);

    // Administrador principal (o primeiro cadastrado)
    const [admin] = await runWithTenant(tenant, () =>
      dataSource.query(
        'SELECT name, email FROM users WHERE is_admin ORDER BY created_at LIMIT 1',
      ),
    );

    return response.json({ ...present(tenant), admin: admin ?? null });
  },
);

internalRouter.patch(
  '/tenants/:id',
  celebrate({
    [Segments.PARAMS]: { id: Joi.string().uuid().required() },
    [Segments.BODY]: {
      name: Joi.string().trim().max(80),
      custom_domain: Joi.string().max(253).allow(null, ''),
      status: Joi.string().valid('active', 'suspended'),
    },
  }),
  async (request: Request, response: Response) => {
    const tenant = await container
      .resolve(TenantsService)
      .update(request.params.id, request.body);

    return response.json(present(tenant));
  },
);

internalRouter.delete(
  '/tenants/:id',
  idParam,
  async (request: Request, response: Response) => {
    await container.resolve(TenantsService).remove(request.params.id);

    return response.status(204).end();
  },
);

// Uso da barbearia: tamanho da equipe e da clientela, movimento e
// faturamento dos últimos 30 dias e a última atividade. As consultas rodam
// dentro da barbearia (o banco só devolve as linhas dela)
async function metrics(): Promise<object> {
  const now = new Date(Date.now());
  const since = subDays(now, 30);

  const [[team], [clients], [appointments], [upcoming], [fees], [members]] =
    await Promise.all([
      dataSource.query(
        'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active FROM users',
      ),
      dataSource.query('SELECT COUNT(*)::int AS total FROM clients'),
      dataSource.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE attendance = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE attendance = 'no_show')::int AS no_show,
           COALESCE(SUM(COALESCE(paid_cents, price_cents)) FILTER (WHERE attendance = 'completed'), 0)::int AS revenue_cents
         FROM appointments
         WHERE canceled_at IS NULL AND date >= $1 AND date < $2`,
        [since, now],
      ),
      dataSource.query(
        'SELECT COUNT(*)::int AS total FROM appointments WHERE canceled_at IS NULL AND date >= $1',
        [now],
      ),
      dataSource.query(
        'SELECT COALESCE(SUM(amount_cents), 0)::int AS total FROM membership_payments WHERE paid_at >= $1',
        [since],
      ),
      dataSource.query(
        "SELECT COUNT(*)::int AS total FROM memberships WHERE status = 'active'",
      ),
    ]);

  const [last] = await dataSource.query(
    'SELECT MAX(created_at) AS at FROM appointments',
  );

  return {
    generated_at: now,
    providers: team.active,
    providers_total: team.total,
    clients: clients.total,
    last_30_days: {
      appointments: appointments.total,
      completed: appointments.completed,
      no_show: appointments.no_show,
      // Atendimentos concluídos + mensalidades do clube
      revenue_cents: appointments.revenue_cents + fees.total,
    },
    upcoming_appointments: upcoming.total,
    active_members: members.total,
    last_activity: last.at,
  };
}

internalRouter.get(
  '/tenants/:id/metrics',
  idParam,
  async (request: Request, response: Response) => {
    const tenant = await container
      .resolve(TenantsService)
      .show(request.params.id);

    return response.json(await runWithTenant(tenant, metrics));
  },
);

// Backup só desta barbearia (.tar.gz)
internalRouter.get(
  '/tenants/:id/export',
  idParam,
  async (request: Request, response: Response) => {
    const tenant = await container
      .resolve(TenantsService)
      .show(request.params.id);
    const archive = await exportTenant(tenant);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');

    response.download(archive, `${tenant.slug}-${stamp}.tar.gz`, () => {
      fs.promises.rm(archive, { force: true });
    });
  },
);

// Cria uma barbearia a partir de um backup (o corpo é o .tar.gz)
internalRouter.post(
  '/tenants/import',
  celebrate({
    [Segments.QUERY]: {
      slug: Joi.string().max(40).allow(''),
      name: Joi.string().trim().max(80).allow(''),
      segment: Joi.string().valid(...SEGMENT_KEYS),
    },
  }),
  async (request: Request, response: Response) => {
    const archive = path.join(
      os.tmpdir(),
      `pontual-upload-${Date.now()}.tar.gz`,
    );

    try {
      await pipeline(request, fs.createWriteStream(archive));

      const tenant = await importTenant(archive, {
        slug: request.query.slug as string | undefined,
        name: request.query.name as string | undefined,
        segment: request.query.segment as string | undefined,
      });

      return response.status(201).json(present(tenant));
    } finally {
      await fs.promises.rm(archive, { force: true });
    }
  },
);

export default internalRouter;
