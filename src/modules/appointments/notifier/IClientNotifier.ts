import Client from '@modules/clients/infra/typeorm/entities/Client';
import Appointment from '../infra/typeorm/entities/Appointment';

// Avisos ao cliente sobre o agendamento, por e-mail e WhatsApp (um canal
// novo entra numa nova implementação, sem mudar quem avisa).
// Os agendamentos chegam com cliente, barbeiro e serviço carregados. Falhas
// no envio não interrompem a operação (são só registradas)
export default interface IClientNotifier {
  // Este canal consegue avisar o cliente (e-mail cadastrado, WhatsApp
  // ligado com telefone válido...)
  reaches(client: Client): Promise<boolean>;
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
  // Cliente fixo: um e-mail com todos os horários marcados (em ordem)
  seriesCreated(
    appointments: Appointment[],
    intervalWeeks: number,
  ): Promise<void>;
  // Cliente fixo: um e-mail com os horários cancelados
  seriesCanceled(appointments: Appointment[]): Promise<void>;
  // Lista de espera: abriu um horário (freed é o agendamento que saiu dele)
  waitlistSlotFreed(client: Client, freed: Appointment): Promise<void>;
}
