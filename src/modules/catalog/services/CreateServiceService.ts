import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import Service from '../infra/typeorm/entities/Service';
import IServicesRepository from '../repositories/IServicesRepository';
import ICreateServiceDTO from '../dtos/ICreateServiceDTO';
import validateServiceData from './validateServiceData';

@injectable()
class CreateServiceService {
  constructor(
    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,
  ) {}

  public async execute(data: ICreateServiceDTO): Promise<Service> {
    const serviceData = validateServiceData(data);

    const services = await this.servicesRepository.findAll({
      only_active: false,
    });

    const nameInUse = services.some(
      service =>
        service.name.toLowerCase() === serviceData.name.toLowerCase(),
    );

    if (nameInUse) {
      throw new AppError('Já existe um serviço com esse nome.');
    }

    return this.servicesRepository.create(serviceData);
  }
}

export default CreateServiceService;
