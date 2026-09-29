/* eslint-disable no-console */
// Os tipos do date-fns e do idioma ficam no mesmo arquivo: a regra de
// imports duplicados confunde os dois
/* eslint-disable import/no-duplicates */
import path from 'path';
import { inject, injectable } from 'tsyringe';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

import IMailProvider from '@shared/container/providers/MailProvider/models/IMailProvider';
import Appointment from '../infra/typeorm/entities/Appointment';
import IClientNotifier from './IClientNotifier';

const views = path.resolve(__dirname, '..', 'views');

// "Sexta-feira, 2 de outubro às 10:00"
const when = (date: Date): string => {
  const text = format(date, "EEEE, d 'de' MMMM 'às' HH:mm", {
    locale: ptBR,
  });

  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Avisos ao cliente por e-mail (clientes cadastrados sem e-mail não recebem)
@injectable()
export default class EmailClientNotifier implements IClientNotifier {
  constructor(
    @inject('MailProvider')
    private mailProvider: IMailProvider,
  ) {}

  public async appointmentCreated(appointment: Appointment): Promise<void> {
    await this.send(
      appointment,
      `[GoBarber] Horário marcado: ${format(
        appointment.date,
        "dd/MM 'às' HH:mm",
      )}`,
      'appointment_created.hbs',
    );
  }

  public async confirmationRequested(
    appointment: Appointment,
    confirmLink: string,
  ): Promise<void> {
    await this.send(
      appointment,
      `[GoBarber] Confirme seu horário de ${format(
        appointment.date,
        "dd/MM 'às' HH:mm",
      )}`,
      'appointment_confirmation.hbs',
      { confirmLink },
    );
  }

  public async appointmentRescheduled(
    appointment: Appointment,
    previous: { date: Date; providerName: string },
  ): Promise<void> {
    await this.send(
      appointment,
      `[GoBarber] Horário remarcado para ${format(
        appointment.date,
        "dd/MM 'às' HH:mm",
      )}`,
      'appointment_rescheduled.hbs',
      {
        previousWhen: when(previous.date),
        previousProvider: previous.providerName,
        providerChanged: previous.providerName !== appointment.provider?.name,
      },
    );
  }

  public async appointmentCanceled(appointment: Appointment): Promise<void> {
    await this.send(
      appointment,
      `[GoBarber] Horário cancelado: ${format(
        appointment.date,
        "dd/MM 'às' HH:mm",
      )}`,
      'appointment_canceled.hbs',
      { byClient: appointment.canceled_by === 'client' },
    );
  }

  public async seriesCreated(
    appointments: Appointment[],
    intervalWeeks: number,
  ): Promise<void> {
    const [first] = appointments;

    await this.send(
      first,
      `[GoBarber] ${appointments.length} horários marcados a partir de ${format(
        first.date,
        'dd/MM',
      )}`,
      'appointment_series_created.hbs',
      {
        dates: appointments.map(item => when(item.date)),
        count: appointments.length,
        interval:
          intervalWeeks === 1
            ? 'toda semana'
            : `a cada ${intervalWeeks} semanas`,
      },
    );
  }

  public async seriesCanceled(appointments: Appointment[]): Promise<void> {
    const [first] = appointments;

    await this.send(
      first,
      `[GoBarber] ${appointments.length} horários cancelados`,
      'appointment_series_canceled.hbs',
      {
        dates: appointments.map(item => when(item.date)),
        count: appointments.length,
      },
    );
  }

  private async send(
    appointment: Appointment,
    subject: string,
    template: string,
    extra: Record<string, string | number | boolean | string[]> = {},
  ): Promise<void> {
    const { client } = appointment;

    if (!client?.email) return;

    try {
      await this.mailProvider.sendMail({
        to: { name: client.name, email: client.email },
        subject,
        templateData: {
          file: path.join(views, template),
          variables: {
            name: client.name.split(' ')[0],
            service: appointment.service?.name || 'Atendimento',
            provider: appointment.provider?.name || 'a barbearia',
            when: when(appointment.date),
            myAppointmentsLink: `${process.env.APP_WEB_URL}/meus-agendamentos`,
            ...extra,
          },
        },
      });
    } catch (err) {
      // O agendamento vale mesmo sem o e-mail: só registra a falha
      console.error(`Falha ao enviar "${subject}" para ${client.email}:`, err);
    }
  }
}
