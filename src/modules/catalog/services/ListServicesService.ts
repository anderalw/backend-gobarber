import { injectable, inject } from 'tsyringe';

import Service from '../infra/typeorm/entities/Service';
import IServicesRepository from '../repositories/IServicesRepository';

interface IRequest {
  // Clientes só veem os ativos; o admin vê todos para poder reativar
  include_inactive: boolean;
}

@injectable()
class ListServicesService {
  constructor(
    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,
  ) {}

  public async execute({ include_inactive }: IRequest): Promise<Service[]> {
    return this.servicesRepository.findAll({ only_active: !include_inactive });
  }
}

export default ListServicesService;
