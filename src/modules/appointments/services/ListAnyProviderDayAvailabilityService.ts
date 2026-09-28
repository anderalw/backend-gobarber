import { injectable, inject } from 'tsyringe';

import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import ListProviderDayAvailabilityService from './ListProviderDayAvailabilityService';

interface IRequest {
  service_id: string;
  day: number;
  month: number;
  year: number;
}

// Horários livres, no formato 'HH:mm'
type IResponse = Array<{ time: string }>;

// "Qualquer barbeiro": um horário aparece se pelo menos um barbeiro ativo
// está livre nele para o serviço escolhido
@injectable()
class ListAnyProviderDayAvailabilityService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject(ListProviderDayAvailabilityService)
    private listProviderDayAvailability: ListProviderDayAvailabilityService,
  ) {}

  public async execute({
    service_id,
    day,
    month,
    year,
  }: IRequest): Promise<IResponse> {
    const providers = await this.usersRepository.findAllProviders({});

    const perProvider = await Promise.all(
      providers.map(provider =>
        this.listProviderDayAvailability.execute({
          provider_id: provider.id,
          service_id,
          day,
          month,
          year,
        }),
      ),
    );

    const times = new Set<string>();

    perProvider.forEach(slots => slots.forEach(({ time }) => times.add(time)));

    // 'HH:mm' em ordem alfabética é a ordem do dia
    return Array.from(times)
      .sort()
      .map(time => ({ time }));
  }
}

export default ListAnyProviderDayAvailabilityService;
