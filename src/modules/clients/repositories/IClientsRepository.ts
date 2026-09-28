import Client from '../infra/typeorm/entities/Client';
import ICreateClientDTO from '../dtos/ICreateClientDTO';

export default interface IClientsRepository {
  create(data: ICreateClientDTO): Promise<Client>;
  findByEmail(email: string): Promise<Client | undefined>;
}
