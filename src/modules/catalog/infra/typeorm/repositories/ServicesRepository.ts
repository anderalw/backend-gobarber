import { getRepository, Repository } from 'typeorm';

import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import ICreateServiceDTO from '@modules/catalog/dtos/ICreateServiceDTO';
import Service from '../entities/Service';

class ServicesRepository implements IServicesRepository {
  private ormRepository: Repository<Service>;

  constructor() {
    this.ormRepository = getRepository(Service);
  }

  public async create(data: ICreateServiceDTO): Promise<Service> {
    const service = this.ormRepository.create({ ...data, active: true });

    await this.ormRepository.save(service);

    return service;
  }

  public async save(service: Service): Promise<Service> {
    return this.ormRepository.save(service);
  }

  public async findById(id: string): Promise<Service | undefined> {
    return this.ormRepository.findOne(id);
  }

  public async findAll({
    only_active,
  }: {
    only_active: boolean;
  }): Promise<Service[]> {
    return this.ormRepository.find({
      where: only_active ? { active: true } : {},
      order: { name: 'ASC' },
    });
  }
}

export default ServicesRepository;
