import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import {
  ensureAgendaOf,
  staffOf,
} from '@shared/infra/http/middlewares/ensurePermission';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '@modules/appointments/repositories/ITimeBlocksRepository';

// Quem pode mexer em cada agendamento ou bloqueio: o próprio barbeiro, ou
// quem tem a permissão de marcar para qualquer barbeiro. Clientes seguem as
// regras deles nos serviços

type Middleware = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

// O barbeiro do corpo (marcar, cliente fixo)
export const forBodyProvider: Middleware = async (request, response, next) => {
  await ensureAgendaOf(request, request.body.provider_id);
  next();
};

// Vários barbeiros de uma vez (bloqueios)
export const forBodyProviders: Middleware = async (request, response, next) => {
  const ids: string[] = request.body.provider_ids || [];

  await Promise.all(ids.map(id => ensureAgendaOf(request, id)));
  next();
};

// O barbeiro do agendamento e, ao remarcar, também o novo barbeiro
export const forAppointment: Middleware = async (request, response, next) => {
  if (request.user.role === 'provider') {
    const appointment = await container
      .resolve<IAppointmentsRepository>('AppointmentsRepository')
      .findById(request.params.id);

    // Sem o agendamento, o serviço responde que não existe
    if (appointment) await ensureAgendaOf(request, appointment.provider_id);

    if (request.body.provider_id) {
      await ensureAgendaOf(request, request.body.provider_id);
    }
  }

  next();
};

// Registrar o pagamento junto com o atendimento é coisa do caixa
export const forPayment: Middleware = async (request, response, next) => {
  if (request.body.payment_method) {
    const user = await staffOf(request);

    if (!user.can('cash')) {
      throw new AppError(
        'Você não tem permissão para registrar pagamentos. Fale com o administrador.',
        403,
      );
    }
  }

  next();
};

// Bloqueio avulso ou repetição
export const forTimeBlock: Middleware = async (request, response, next) => {
  const repository = container.resolve<ITimeBlocksRepository>(
    'TimeBlocksRepository',
  );
  const block =
    (await repository.findById(request.params.id)) ||
    (await repository.findRecurringById(request.params.id));

  if (block) await ensureAgendaOf(request, block.provider_id);

  next();
};
