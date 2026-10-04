import Service from '../infra/typeorm/entities/Service';
import ICreateServiceDTO from '../dtos/ICreateServiceDTO';

export default interface IServicesRepository {
  create(data: ICreateServiceDTO): Promise<Service>;
  save(service: Service): Promise<Service>;
  findById(id: string): Promise<Service | undefined>;
  // Na ordem escolhida pela barbearia; only_active = só os que os clientes
  // podem escolher
  findAll(options: { only_active: boolean }): Promise<Service[]>;
  // Grava a nova ordem (posição = índice na lista)
  savePositions(ids: string[]): Promise<void>;
}
