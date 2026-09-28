import Appointment from '../infra/typeorm/entities/Appointment';
import ICreateAppointmentDTO from '../dtos/ICreateAppointmentDTO';
import IFindAllInMonthFromProviderDTO from '../dtos/IFindAllInMonthFromProviderDTO';
import IFindAllInDayFromProviderDTO from '../dtos/IFindAllInDayFromProviderDTO';
import IFindAllInDayDTO from '../dtos/IFindAllInDayDTO';
import IFindOverlappingDTO from '../dtos/IFindOverlappingDTO';

// Salvo findById, as buscas ignoram agendamentos cancelados
export default interface IAppointmentsRepository {
  create(data: ICreateAppointmentDTO): Promise<Appointment>;
  save(appointment: Appointment): Promise<Appointment>;
  // Com cliente, barbeiro e serviço
  findById(id: string): Promise<Appointment | undefined>;
  // Algum agendamento do barbeiro que ocupe parte do intervalo pedido
  findOverlapping(data: IFindOverlappingDTO): Promise<Appointment | undefined>;
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
}
