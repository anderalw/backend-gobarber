import { randomUUID } from 'crypto';

import IMembershipPlansRepository, {
  IPlanData,
} from '../IMembershipPlansRepository';
import MembershipPlan from '../../infra/typeorm/entities/MembershipPlan';

class FakeMembershipPlansRepository implements IMembershipPlansRepository {
  public plans: MembershipPlan[] = [];

  public async create(data: IPlanData): Promise<MembershipPlan> {
    const plan = Object.assign(new MembershipPlan(), data, {
      id: randomUUID(),
      created_at: new Date(Date.now()),
      updated_at: new Date(Date.now()),
    });

    this.plans.push(plan);

    return plan;
  }

  public async save(plan: MembershipPlan): Promise<MembershipPlan> {
    const index = this.plans.findIndex(item => item.id === plan.id);

    this.plans[index] = plan;

    return plan;
  }

  public async findById(id: string): Promise<MembershipPlan | undefined> {
    return this.plans.find(plan => plan.id === id);
  }

  public async findAll({
    only_active,
  }: {
    only_active: boolean;
  }): Promise<MembershipPlan[]> {
    return this.plans
      .filter(plan => !only_active || plan.active)
      .sort((a, b) => a.price_cents - b.price_cents);
  }
}

export default FakeMembershipPlansRepository;
