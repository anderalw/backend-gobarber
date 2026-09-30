import { randomUUID } from 'crypto';

import Client from '@modules/clients/infra/typeorm/entities/Client';
import IMembershipsRepository, {
  ICreateMembershipDTO,
} from '../IMembershipsRepository';
import Membership, {
  MembershipStatus,
} from '../../infra/typeorm/entities/Membership';
import FakeMembershipPlansRepository from './FakeMembershipPlansRepository';

// Com os planos para montar a relação; o cliente vem só com id e nome
class FakeMembershipsRepository implements IMembershipsRepository {
  public memberships: Membership[] = [];

  constructor(private plans: FakeMembershipPlansRepository) {}

  public async create(data: ICreateMembershipDTO): Promise<Membership> {
    const membership = Object.assign(new Membership(), {
      id: randomUUID(),
      cycle_anchor: null,
      paid_until: null,
      requested_at: null,
      started_at: null,
      canceled_at: null,
      created_by: null,
      created_at: new Date(Date.now()),
      updated_at: new Date(Date.now()),
      ...data,
    });

    this.memberships.push(membership);

    return this.withRelations(membership);
  }

  public async save(membership: Membership): Promise<Membership> {
    const index = this.memberships.findIndex(item => item.id === membership.id);

    this.memberships[index] = membership;

    return membership;
  }

  public async findById(id: string): Promise<Membership | undefined> {
    const found = this.memberships.find(item => item.id === id);

    return found && this.withRelations(found);
  }

  public async findCurrentByClient(
    client_id: string,
  ): Promise<Membership | undefined> {
    const found = this.memberships.find(
      item =>
        item.client_id === client_id &&
        (item.status === 'pending' || item.status === 'active'),
    );

    return found && this.withRelations(found);
  }

  public async findByStatus(
    statuses: MembershipStatus[],
  ): Promise<Membership[]> {
    return Promise.all(
      this.memberships
        .filter(item => statuses.includes(item.status))
        .map(item => this.withRelations(item)),
    );
  }

  public async findCanceledSince(date: Date): Promise<Membership[]> {
    return Promise.all(
      this.memberships
        .filter(
          item =>
            item.status === 'canceled' &&
            !!item.canceled_at &&
            item.canceled_at >= date,
        )
        .map(item => this.withRelations(item)),
    );
  }

  private async withRelations(membership: Membership): Promise<Membership> {
    return Object.assign(membership, {
      plan: await this.plans.findById(membership.plan_id),
      client: Object.assign(new Client(), {
        id: membership.client_id,
        name: `Cliente ${membership.client_id}`,
      }),
    });
  }
}

export default FakeMembershipsRepository;
