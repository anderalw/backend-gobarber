import Client from '../infra/typeorm/entities/Client';

export default interface IClientsRepository {
  create(data: any): Promise<Client>;
  findByEmail(email: string): Promise<Client | undefined>;
}