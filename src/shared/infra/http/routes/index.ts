import { Router } from 'express';
import appointmentsRouter from '@modules/appointments/infra/http/routes/appointments.routes';
import providersRouter from '@modules/appointments/infra/http/routes/providers.routes';
import agendaRouter from '@modules/appointments/infra/http/routes/agenda.routes';
import blockReasonsRouter from '@modules/appointments/infra/http/routes/blockReasons.routes';
import timeBlocksRouter from '@modules/appointments/infra/http/routes/timeBlocks.routes';
import notificationsRouter from '@modules/notifications/infra/http/routes/notifications.routes';
import reportsRouter from '@modules/appointments/infra/http/routes/reports.routes';
import servicesRouter from '@modules/catalog/infra/http/routes/services.routes';
import settingsRouter from '@modules/catalog/infra/http/routes/settings.routes';
import usersRouter from '@modules/users/infra/http/routes/users.routes';
import sessionsRouter from '@modules/users/infra/http/routes/sessions.routes';
import passwordRouter from '@modules/users/infra/http/routes/password.routes';
import profileRouter from '@modules/users/infra/http/routes/profile.routes';
import clientsRouter from '@modules/clients/infra/http/routes/clients.routes';
import clientsSessionsRouter from '@modules/clients/infra/http/routes/sessions.routes';
import providerSchedulesRouter from '@modules/users/infra/http/routes/providerSchedules.routes';

const routes = Router();

routes.use('/appointments', appointmentsRouter);
routes.use('/providers', providersRouter);
routes.use('/agenda', agendaRouter);
routes.use('/blocks', timeBlocksRouter);
routes.use('/block-reasons', blockReasonsRouter);
routes.use('/notifications', notificationsRouter);
routes.use('/reports', reportsRouter);
routes.use('/services', servicesRouter);
routes.use('/settings', settingsRouter);
routes.use('/users', usersRouter);
routes.use('/sessions', sessionsRouter);
routes.use('/password', passwordRouter);
routes.use('/profile', profileRouter);
routes.use('/clients', clientsRouter);
routes.use('/clients/sessions', clientsSessionsRouter);
routes.use('/schedules', providerSchedulesRouter);

export default routes;
