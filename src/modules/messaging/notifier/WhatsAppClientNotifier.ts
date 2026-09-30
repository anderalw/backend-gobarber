/* eslint-disable no-console */
import { inject, injectable } from 'tsyringe';
import { format } from 'date-fns';

import BrandingService from '@modules/catalog/services/BrandingService';
import Client from '@modules/clients/infra/typeorm/entities/Client';
import Appointment from '@modules/appointments/infra/typeorm/entities/Appointment';
import IClientNotifier from '@modules/appointments/notifier/IClientNotifier';
import { MessageKind } from '../infra/typeorm/entities/WhatsAppMessage';
import WhatsAppService from '../services/WhatsAppService';
import {
  canceledText,
  createdText,
  reminderText,
  rescheduledText,
  seriesCanceledText,
  seriesCreatedText,
  waitlistText,
} from '../templates/whatsappTexts';

// Avisos ao cliente por WhatsApp (os mesmos momentos do e-mail). Entram na
// fila; saem na hora ou pelo envio assistido, conforme a configuração
@injectable()
export default class WhatsAppClientNotifier implements IClientNotifier {
  constructor(
    @inject(WhatsAppService)
    private whatsapp: WhatsAppService,

    @inject(BrandingService)
    private branding: BrandingService,
  ) {}

  public async reaches(client: Client): Promise<boolean> {
    return this.whatsapp.reaches(client.phone, 'reminder');
  }

  public async appointmentCreated(appointment: Appointment): Promise<void> {
    await this.send(
      'appointment_created',
      appointment,
      shop => createdText(appointment, shop),
      appointment.id,
    );
  }

  public async confirmationRequested(
    appointment: Appointment,
    confirmLink: string,
  ): Promise<void> {
    await this.send(
      'reminder',
      appointment,
      shop => reminderText(appointment, shop, confirmLink),
      // Um lembrete por pedido de confirmação (remarcar gera outro)
      `${appointment.id}:${confirmLink.slice(-12)}`,
    );
  }

  public async appointmentRescheduled(appointment: Appointment): Promise<void> {
    await this.send(
      'appointment_rescheduled',
      appointment,
      shop => rescheduledText(appointment, shop),
      `${appointment.id}:${format(appointment.date, "yyyyMMdd'T'HHmm")}:${
        appointment.provider_id
      }`,
    );
  }

  public async appointmentCanceled(appointment: Appointment): Promise<void> {
    await this.send(
      'appointment_canceled',
      appointment,
      shop => canceledText(appointment, shop),
      appointment.id,
      // Informativo: vale até o horário que foi cancelado
      appointment.date,
    );
  }

  public async seriesCreated(
    appointments: Appointment[],
    intervalWeeks: number,
  ): Promise<void> {
    const [first] = appointments;

    await this.send(
      'series_created',
      first,
      shop =>
        seriesCreatedText(
          appointments,
          shop,
          intervalWeeks === 1
            ? 'toda semana'
            : `a cada ${intervalWeeks} semanas`,
        ),
      first.series_id || first.id,
    );
  }

  public async seriesCanceled(appointments: Appointment[]): Promise<void> {
    const [first] = appointments;

    await this.send(
      'series_canceled',
      first,
      shop => seriesCanceledText(appointments, shop),
      `${first.series_id || first.id}:${first.id}`,
    );
  }

  public async waitlistSlotFreed(
    client: Client,
    freed: Appointment,
  ): Promise<void> {
    await this.send(
      'waitlist_slot',
      freed,
      shop => waitlistText(client.name, freed, shop),
      `${client.id}:${freed.id}`,
      freed.date,
      client,
    );
  }

  // Falhas não interrompem a operação: só registra
  private async send(
    kind: MessageKind,
    appointment: Appointment,
    text: (shop: string) => string,
    key: string,
    expires_at: Date = appointment.date,
    recipient: Client | null = appointment.client,
  ): Promise<void> {
    if (!recipient) return;

    try {
      const { name } = await this.branding.get();

      await this.whatsapp.enqueue({
        kind,
        client: {
          id: recipient.id,
          name: recipient.name,
          phone: recipient.phone,
        },
        body: text(name),
        dedupe_key: `${kind}:${key}`,
        expires_at,
      });
    } catch (err) {
      console.error(`Falha ao preparar o WhatsApp "${kind}":`, err);
    }
  }
}
