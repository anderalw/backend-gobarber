import { Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import IMembershipPlansRepository, {
  IPlanData,
} from '@modules/memberships/repositories/IMembershipPlansRepository';

import MembershipPlan from '../entities/MembershipPlan';

class MembershipPlansRepository implements IMembershipPlansRepository {
  private ormRepository: Repository<MembershipPlan>;

  constructor() {
    this.ormRepository = dataSource.getRepository(MembershipPlan);
  }

  public async create(data: IPlanData): Promise<MembershipPlan> {
    return this.ormRepository.save(this.ormRepository.create(data));
  }

  public async save(plan: MembershipPlan): Promise<MembershipPlan> {
    return this.ormRepository.save(plan);
  }

  public async findById(id: string): Promise<MembershipPlan | undefined> {
    // Sem id o TypeORM 0.3 ignoraria o filtro e traria o primeiro registro
    if (!id) return undefined;

    return (await this.ormRepository.findOneBy({ id })) ?? undefined;
  }

  public async findAll({
    only_active,
  }: {
    only_active: boolean;
  }): Promise<MembershipPlan[]> {
    return this.ormRepository.find({
      where: only_active ? { active: true } : {},
      order: { price_cents: 'ASC', name: 'ASC' },
    });
  }
}

export default MembershipPlansRepository;
