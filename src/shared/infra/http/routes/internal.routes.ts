import { Router, Request, Response } from 'express';
import { subDays } from 'date-fns';

import dataSource from '@shared/infra/typeorm/dataSource';
import ensureMetricsToken from '../middlewares/ensureMetricsToken';

const internalRouter = Router();

internalRouter.use(ensureMetricsToken);

// Uso da barbearia para o painel do SaaS: tamanho da equipe e da clientela,
// movimento e faturamento dos últimos 30 dias e a última atividade
internalRouter.get('/metrics', async (request: Request, response: Response) => {
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
           COALESCE(SUM(COALESCE(paid_cents, price_cents)) FILTER (WHERE attendance = 'completed'), 0)::int AS revenue_cents,
           MAX(created_at) AS last_booking
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

  return response.json({
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
  });
});

export default internalRouter;
