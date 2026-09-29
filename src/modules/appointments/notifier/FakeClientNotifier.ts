import Appointment from '../infra/typeorm/entities/Appointment';
import IClientNotifier from './IClientNotifier';

interface ISentNotice {
  kind: 'created' | 'confirmation' | 'rescheduled' | 'canceled';
  appointment_id: string;
  link?: string;
}

// Guarda os avisos em memória, para os testes conferirem o que foi enviado
export default class FakeClientNotifier implements IClientNotifier {
  public sent: ISentNotice[] = [];

  public async appointmentCreated(appointment: Appointment): Promise<void> {
    this.sent.push({ kind: 'created', appointment_id: appointment.id });
  }

  public async confirmationRequested(
    appointment: Appointment,
    confirmLink: string,
  ): Promise<void> {
    this.sent.push({
      kind: 'confirmation',
      appointment_id: appointment.id,
      link: confirmLink,
    });
  }

  public async appointmentRescheduled(appointment: Appointment): Promise<void> {
    this.sent.push({ kind: 'rescheduled', appointment_id: appointment.id });
  }

  public async appointmentCanceled(appointment: Appointment): Promise<void> {
    this.sent.push({ kind: 'canceled', appointment_id: appointment.id });
  }
}
