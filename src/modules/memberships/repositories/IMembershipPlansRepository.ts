import MembershipPlan, {
  IPlanItem,
} from '../infra/typeorm/entities/MembershipPlan';

export interface IPlanData {
  name: string;
  description: string | null;
  price_cents: number;
  items: IPlanItem[];
  min_interval_days: number | null;
  weekdays: number[] | null;
  discount_percent: number;
  active: boolean;
}

export default interface IMembershipPlansRepository {
  create(data: IPlanData): Promise<MembershipPlan>;
  save(plan: MembershipPlan): Promise<MembershipPlan>;
  findById(id: string): Promise<MembershipPlan | undefined>;
  // Por preço; only_active = os que aceitam novas assinaturas
  findAll(options: { only_active: boolean }): Promise<MembershipPlan[]>;
}
