import { format } from 'date-fns';
import { injectable, inject } from 'tsyringe';

import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ensureCanChangeAppointment, {
  IRequester,
} from '../utils/ensureCanChangeAppointment';

interface IRequest {
  appointment_id: string;
  requester: IRequester;
}

// Cancelar não apaga: marca quando e quem cancelou, e o horário fica livre
@injectable()
class CancelAppointmentService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,
  ) {}

  public async execute({
    appointment_id,
    requester,
  }: IRequest): Promise<Appointment> {
    const now = new Date(Date.now());

    const appointment = ensureCanChangeAppointment(
      await this.appointmentsRepository.findById(appointment_id),
      requester,
      now,
    );

    appointment.canceled_at = now;
    appointment.canceled_by = requester.role;

    const canceled = await this.appointmentsRepository.save(appointment);

    const serviceName = appointment.service?.name || 'serviço';
    const who = requester.role === 'client' ? 'pelo cliente' : 'pela barbearia';

    await this.notificationsRepository.create({
      recipient_id: appointment.provider_id,
      content: `Agendamento de ${serviceName} em ${format(
        appointment.date,
        "dd/MM/yyyy 'às' HH:mm",
      )} cancelado ${who}`,
      date: appointment.date,
    });

    await this.cacheProvider.invalidate(
      `provider-appointments:${appointment.provider_id}:${format(
        appointment.date,
        'yyyy-M-d',
      )}`,
    );

    return canceled;
  }
}

export default CancelAppointmentService;
