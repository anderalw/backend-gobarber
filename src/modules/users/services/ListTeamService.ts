import { injectable, inject } from 'tsyringe';

import IUsersRepository from '../repositories/IUsersRepository';
import IProviderSchedulesRepository from '../repositories/IProviderSchedulesRepository';

interface ITeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean;
  active: boolean;
  // Dias em que atende (0 = domingo), em ordem
  schedules: { day_of_week: number; start_time: string; end_time: string }[];
}

// Equipe completa para a tela de administração: inclui quem está logado e
// os barbeiros desativados, com os horários de trabalho de cada um
@injectable()
class ListTeamService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,
  ) {}

  public async execute(): Promise<ITeamMember[]> {
    const users = await this.usersRepository.findAllProviders({
      include_inactive: true,
    });

    const members = await Promise.all(
      users.map(async user => {
        const schedules =
          await this.providerSchedulesRepository.findByProviderId(user.id);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.getAvatarUrl(),
          is_admin: user.isAdmin,
          active: user.active,
          schedules: schedules
            .map(({ day_of_week, start_time, end_time }) => ({
              day_of_week,
              start_time,
              end_time,
            }))
            .sort((a, b) => a.day_of_week - b.day_of_week),
        };
      }),
    );

    // Ativos primeiro, depois por nome
    return members.sort(
      (a, b) =>
        Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
    );
  }
}

export default ListTeamService;
