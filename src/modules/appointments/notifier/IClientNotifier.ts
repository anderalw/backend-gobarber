import Appointment from '../infra/typeorm/entities/Appointment';

// Avisos ao cliente sobre o agendamento. Hoje por e-mail; outros canais
// (ex: WhatsApp) entram numa nova implementação, sem mudar quem avisa.
// Os agendamentos chegam com cliente, barbeiro e serviço carregados. Falhas
// no envio não interrompem a operação (são só registradas)
export default interface IClientNotifier {
  // Informativo: o horário foi marcado
  appointmentCreated(appointment: Appointment): Promise<void>;
  // Na véspera: pede para o cliente confirmar pelo link
  confirmationRequested(
    appointment: Appointment,
    confirmLink: string,
  ): Promise<void>;
  // Informativo: mudou o dia, o horário ou o barbeiro
  appointmentRescheduled(
    appointment: Appointment,
    previous: { date: Date; providerName: string },
  ): Promise<void>;
  // Informativo: o horário foi cancelado
  appointmentCanceled(appointment: Appointment): Promise<void>;
}
