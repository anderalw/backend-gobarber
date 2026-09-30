import { inject, injectable } from 'tsyringe';

import Client from '@modules/clients/infra/typeorm/entities/Client';
import WhatsAppClientNotifier from '@modules/messaging/notifier/WhatsAppClientNotifier';
import Appointment from '../infra/typeorm/entities/Appointment';
import IClientNotifier from './IClientNotifier';
import EmailClientNotifier from './EmailClientNotifier';

// Avisa o cliente por todos os canais: e-mail e WhatsApp (cada um decide se
// alcança o cliente). Um canal com problema não impede o outro
@injectable()
export default class CompositeClientNotifier implements IClientNotifier {
  private channels: IClientNotifier[];

  constructor(
    @inject(EmailClientNotifier)
    email: EmailClientNotifier,

    @inject(WhatsAppClientNotifier)
    whatsapp: WhatsAppClientNotifier,
  ) {
    this.channels = [email, whatsapp];
  }

  public async reaches(client: Client): Promise<boolean> {
    const results = await Promise.all(
      this.channels.map(channel => channel.reaches(client)),
    );

    return results.some(Boolean);
  }

  public async appointmentCreated(appointment: Appointment): Promise<void> {
    await this.all(channel => channel.appointmentCreated(appointment));
  }

  public async confirmationRequested(
    appointment: Appointment,
    confirmLink: string,
  ): Promise<void> {
    await this.all(channel =>
      channel.confirmationRequested(appointment, confirmLink),
    );
  }

  public async appointmentRescheduled(
    appointment: Appointment,
    previous: { date: Date; providerName: string },
  ): Promise<void> {
    await this.all(channel =>
      channel.appointmentRescheduled(appointment, previous),
    );
  }

  public async appointmentCanceled(appointment: Appointment): Promise<void> {
    await this.all(channel => channel.appointmentCanceled(appointment));
  }

  public async seriesCreated(
    appointments: Appointment[],
    intervalWeeks: number,
  ): Promise<void> {
    await this.all(channel =>
      channel.seriesCreated(appointments, intervalWeeks),
    );
  }

  public async seriesCanceled(appointments: Appointment[]): Promise<void> {
    await this.all(channel => channel.seriesCanceled(appointments));
  }

  public async waitlistSlotFreed(
    client: Client,
    freed: Appointment,
  ): Promise<void> {
    await this.all(channel => channel.waitlistSlotFreed(client, freed));
  }

  private async all(
    action: (channel: IClientNotifier) => Promise<void>,
  ): Promise<void> {
    await Promise.allSettled(this.channels.map(action));
  }
}
