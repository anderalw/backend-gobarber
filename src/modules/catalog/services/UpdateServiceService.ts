import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import Service from '../infra/typeorm/entities/Service';
import IServicesRepository from '../repositories/IServicesRepository';
import ICreateServiceDTO from '../dtos/ICreateServiceDTO';
import validateServiceData from './validateServiceData';

interface IRequest extends ICreateServiceDTO {
  id: string;
  active: boolean;
}

// Editar não altera agendamentos já feitos: eles guardam a duração e o
// valor do momento da marcação
@injectable()
class UpdateServiceService {
  constructor(
    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,
  ) {}

  public async execute({ id, active, ...data }: IRequest): Promise<Service> {
    const service = await this.servicesRepository.findById(id);

    if (!service) {
      throw new AppError('Serviço não encontrado.', 404);
    }

    const serviceData = validateServiceData(data);

    const services = await this.servicesRepository.findAll({
      only_active: false,
    });

    const nameInUse = services.some(
      other =>
        other.id !== id &&
        other.name.toLowerCase() === serviceData.name.toLowerCase(),
    );

    if (nameInUse) {
      throw new AppError('Já existe um serviço com esse nome.');
    }

    Object.assign(service, serviceData, { active });

    return this.servicesRepository.save(service);
  }
}

export default UpdateServiceService;
