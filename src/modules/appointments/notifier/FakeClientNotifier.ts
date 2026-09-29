import Client from '@modules/clients/infra/typeorm/entities/Client';
import Appointment from '../infra/typeorm/entities/Appointment';
import IClientNotifier from './IClientNotifier';

interface ISentNotice {
  kind:
    | 'created'
    | 'confirmation'
    | 'rescheduled'
    | 'canceled'
    | 'series-created'
    | 'series-canceled'
    | 'waitlist';
  // Na série, o primeiro horário
  appointment_id: string;
  count?: number;
  link?: string;
  // Lista de espera: quem recebeu o aviso
  client_id?: string;
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

  public async seriesCreated(appointments: Appointment[]): Promise<void> {
    this.sent.push({
      kind: 'series-created',
      appointment_id: appointments[0].id,
      count: appointments.length,
    });
  }

  public async waitlistSlotFreed(
    client: Client,
    freed: Appointment,
  ): Promise<void> {
    this.sent.push({
      kind: 'waitlist',
      appointment_id: freed.id,
      client_id: client.id,
    });
  }

  public async seriesCanceled(appointments: Appointment[]): Promise<void> {
    this.sent.push({
      kind: 'series-canceled',
      appointment_id: appointments[0].id,
      count: appointments.length,
    });
  }
}
