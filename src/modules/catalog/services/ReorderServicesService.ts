import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import Service from '../infra/typeorm/entities/Service';
import IServicesRepository from '../repositories/IServicesRepository';

// A barbearia escolhe a ordem dos serviços (site e tela de agendar). A lista
// precisa ter todos os serviços, cada um uma vez
@injectable()
class ReorderServicesService {
  constructor(
    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,
  ) {}

  public async execute(ids: string[]): Promise<Service[]> {
    const services = await this.servicesRepository.findAll({
      only_active: false,
    });
    const known = new Set(services.map(service => service.id));

    if (
      ids.length !== services.length ||
      new Set(ids).size !== ids.length ||
      ids.some(id => !known.has(id))
    ) {
      throw new AppError(
        'A lista mudou enquanto você ordenava. Recarregue a página e tente de novo.',
      );
    }

    await this.servicesRepository.savePositions(ids);

    return this.servicesRepository.findAll({ only_active: false });
  }
}

export default ReorderServicesService;
