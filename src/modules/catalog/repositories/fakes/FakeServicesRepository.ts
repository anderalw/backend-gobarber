import { randomUUID } from 'crypto';

import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import ICreateServiceDTO from '@modules/catalog/dtos/ICreateServiceDTO';
import Service from '../../infra/typeorm/entities/Service';

class FakeServicesRepository implements IServicesRepository {
  private services: Service[] = [];

  public async create(data: ICreateServiceDTO): Promise<Service> {
    const service = new Service();

    Object.assign(service, { id: randomUUID(), active: true }, data);

    this.services.push(service);

    return service;
  }

  public async save(service: Service): Promise<Service> {
    const index = this.services.findIndex(item => item.id === service.id);

    this.services[index] = service;

    return service;
  }

  public async findById(id: string): Promise<Service | undefined> {
    return this.services.find(service => service.id === id);
  }

  public async findAll({
    only_active,
  }: {
    only_active: boolean;
  }): Promise<Service[]> {
    return this.services
      .filter(service => !only_active || service.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default FakeServicesRepository;
