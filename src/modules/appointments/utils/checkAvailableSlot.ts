import { addMinutes, getDay, isAfter, isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import workWindow from './workWindow';

interface IDependencies {
  usersRepository: IUsersRepository;
  appointmentsRepository: IAppointmentsRepository;
  providerSchedulesRepository: IProviderSchedulesRepository;
  agendaSettings: AgendaSettingsService;
  timeBlocksRepository: ITimeBlocksRepository;
}

interface ICheckAvailableSlot {
  provider_id: string;
  start: Date;
  durationMinutes: number;
  // Ao remarcar, o próprio agendamento não conta como conflito
  except_appointment_id?: string;
}

interface ISlot {
  end: Date;
  // Fim + intervalo entre atendimentos
  blockedUntil: Date;
}

// Regras comuns a agendar e remarcar: não pode ser no passado, o
// atendimento inteiro precisa caber no expediente do barbeiro, fora dos
// bloqueios, e não pode sobrepor outro agendamento (incluindo os intervalos)
export default async function checkAvailableSlot(
  {
    usersRepository,
    appointmentsRepository,
    providerSchedulesRepository,
    agendaSettings,
    timeBlocksRepository,
  }: IDependencies,
  {
    provider_id,
    start,
    durationMinutes,
    except_appointment_id,
  }: ICheckAvailableSlot,
): Promise<ISlot> {
  if (isBefore(start, Date.now())) {
    throw new AppError('Não é possível agendar numa data passada.');
  }

  const provider = await usersRepository.findById(provider_id);

  if (!provider) {
    throw new AppError('Barbeiro não encontrado.');
  }

  if (!provider.active) {
    throw new AppError('Este barbeiro não está atendendo no momento.');
  }

  const schedules = await providerSchedulesRepository.findByProviderId(
    provider_id,
  );

  const scheduleForDay = schedules.find(
    schedule => schedule.day_of_week === getDay(start),
  );

  if (!scheduleForDay) {
    throw new AppError('O barbeiro não atende neste dia.');
  }

  const end = addMinutes(start, durationMinutes);
  const { workStart, workEnd } = workWindow(start, scheduleForDay);

  if (isBefore(start, workStart) || isAfter(end, workEnd)) {
    throw new AppError(
      `Este barbeiro só atende entre ${scheduleForDay.start_time} e ${scheduleForDay.end_time}.`,
    );
  }

  // Como no fim do expediente, o intervalo depois do atendimento pode
  // avançar sobre o bloqueio (ver blocksAsBusy)
  const blocks = await timeBlocksRepository.findInRange({
    provider_id,
    start,
    end,
  });

  if (blocks.length > 0) {
    throw new AppError('O barbeiro não está atendendo neste horário.');
  }

  const { buffer_minutes } = await agendaSettings.get();
  const blockedUntil = addMinutes(end, buffer_minutes);

  const overlapping = await appointmentsRepository.findOverlapping({
    provider_id,
    start,
    end: blockedUntil,
    except_appointment_id,
  });

  if (overlapping) {
    throw new AppError('Este horário já está reservado.');
  }

  return { end, blockedUntil };
}
