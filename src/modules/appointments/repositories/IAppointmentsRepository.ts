import Appointment from '../infra/typeorm/entities/Appointment';
import ICreateAppointmentDTO from '../dtos/ICreateAppointmentDTO';
import IFindAllInMonthFromProviderDTO from '../dtos/IFindAllInMonthFromProviderDTO';
import IFindAllInDayFromProviderDTO from '../dtos/IFindAllInDayFromProviderDTO';
import IFindAllInDayDTO from '../dtos/IFindAllInDayDTO';
import IFindOverlappingDTO from '../dtos/IFindOverlappingDTO';

export default interface IAppointmentsRepository {
  create(data: ICreateAppointmentDTO): Promise<Appointment>;
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
}
