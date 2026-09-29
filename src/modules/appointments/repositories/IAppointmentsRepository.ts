import Appointment from '../infra/typeorm/entities/Appointment';
import ICreateAppointmentDTO from '../dtos/ICreateAppointmentDTO';
import IFindAllInMonthFromProviderDTO from '../dtos/IFindAllInMonthFromProviderDTO';
import IFindAllInDayFromProviderDTO from '../dtos/IFindAllInDayFromProviderDTO';
import IFindAllInDayDTO from '../dtos/IFindAllInDayDTO';
import IFindOverlappingDTO from '../dtos/IFindOverlappingDTO';
import ISetAttendanceDTO from '../dtos/ISetAttendanceDTO';
import IClientSummaryDTO from '../dtos/IClientSummaryDTO';
import IClientVisitsDTO from '../dtos/IClientVisitsDTO';

// Salvo findById, as buscas ignoram agendamentos cancelados
export default interface IAppointmentsRepository {
  create(data: ICreateAppointmentDTO): Promise<Appointment>;
  save(appointment: Appointment): Promise<Appointment>;
  // Com cliente, barbeiro e serviço
  findById(id: string): Promise<Appointment | undefined>;
  // Algum agendamento do barbeiro que ocupe parte do intervalo pedido
  findOverlapping(data: IFindOverlappingDTO): Promise<Appointment | undefined>;
  // Atendimentos do barbeiro que ocupam parte do intervalo (sem contar o
  // intervalo depois de cada um)
  findInRangeFromProvider(data: IFindOverlappingDTO): Promise<Appointment[]>;
  findAllInMonthFromProvider(
    data: IFindAllInMonthFromProviderDTO,
  ): Promise<Appointment[]>;
  findAllInDayFromProvider(
    data: IFindAllInDayFromProviderDTO,
  ): Promise<Appointment[]>;
  // Agendamentos do dia de todos os barbeiros, com o cliente e o serviço
  findAllInDay(data: IFindAllInDayDTO): Promise<Appointment[]>;
  // Agendamentos do cliente que ainda não terminaram, do mais próximo ao
  // mais distante, com o barbeiro e o serviço
  findUpcomingFromClient(client_id: string, now: Date): Promise<Appointment[]>;
  // Quantos agendamentos do barbeiro ainda não terminaram
  countUpcomingFromProvider(provider_id: string, now: Date): Promise<number>;
  // Registra (ou desfaz) a situação do atendimento
  setAttendance(data: ISetAttendanceDTO): Promise<void>;
  // Todos os agendamentos que começam no período, inclusive os cancelados,
  // com cliente, barbeiro e serviço (para o faturamento e o caixa)
  findAllInPeriod(start: Date, end: Date): Promise<Appointment[]>;
  // Ativos que começam no intervalo e ainda não tiveram a confirmação
  // pedida, com cliente, barbeiro e serviço
  findAwaitingConfirmationRequest(
    start: Date,
    end: Date,
  ): Promise<Appointment[]>;
  // Guarda o link enviado; false se o pedido já tinha sido feito (evita
  // mandar dois e-mails quando a tarefa roda em paralelo)
  markConfirmationRequested(
    id: string,
    token: string,
    requested_at: Date,
  ): Promise<boolean>;
  // Com cliente, barbeiro e serviço
  findByConfirmationToken(token: string): Promise<Appointment | undefined>;
  // confirmed_by: barbeiro que registrou (omitido = o cliente, pelo link);
  // confirmed_at null desfaz
  markConfirmed(
    id: string,
    confirmed_at: Date | null,
    confirmed_by?: string | null,
  ): Promise<void>;
  // Resumo do histórico de cada cliente (só os que têm agendamentos);
  // recent_no_shows conta as faltas entre os últimos recentCount
  // agendamentos que já passaram
  summarizeByClients(
    client_ids: string[],
    now: Date,
    recentCount: number,
  ): Promise<IClientSummaryDTO[]>;
  // Primeira e última visita de todos os clientes que já agendaram
  clientVisits(now: Date): Promise<IClientVisitsDTO[]>;
  // Todos os agendamentos do cliente, inclusive cancelados, do mais recente
  // ao mais antigo, com o barbeiro e o serviço
  findAllFromClient(client_id: string): Promise<Appointment[]>;
  // Cliente fixo: agendamentos ativos da série a partir de from (inclusive),
  // em ordem, com cliente, barbeiro e serviço
  findFollowingInSeries(series_id: string, from: Date): Promise<Appointment[]>;
  // Agendamentos do barbeiro que ainda não terminaram, em ordem
  findUpcomingFromProvider(
    provider_id: string,
    now: Date,
  ): Promise<Appointment[]>;
}
