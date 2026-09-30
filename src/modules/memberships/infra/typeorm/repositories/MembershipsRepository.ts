import { In, MoreThanOrEqual, Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import IMembershipsRepository, {
  ICreateMembershipDTO,
} from '@modules/memberships/repositories/IMembershipsRepository';

import Membership, { MembershipStatus } from '../entities/Membership';

const relations = ['client', 'plan'];

class MembershipsRepository implements IMembershipsRepository {
  private ormRepository: Repository<Membership>;

  constructor() {
    this.ormRepository = dataSource.getRepository(Membership);
  }

  public async create(data: ICreateMembershipDTO): Promise<Membership> {
    const membership = await this.ormRepository.save(
      this.ormRepository.create(data),
    );

    return (await this.findById(membership.id)) as Membership;
  }

  public async save(membership: Membership): Promise<Membership> {
    return this.ormRepository.save(membership);
  }

  public async findById(id: string): Promise<Membership | undefined> {
    // Sem id o TypeORM 0.3 ignoraria o filtro e traria o primeiro registro
    if (!id) return undefined;

    return (
      (await this.ormRepository.findOne({ where: { id }, relations })) ??
      undefined
    );
  }

  public async findCurrentByClient(
    client_id: string,
  ): Promise<Membership | undefined> {
    if (!client_id) return undefined;

    return (
      (await this.ormRepository.findOne({
        where: { client_id, status: In(['pending', 'active']) },
        relations,
        order: { created_at: 'DESC' },
      })) ?? undefined
    );
  }

  public async findByStatus(
    statuses: MembershipStatus[],
  ): Promise<Membership[]> {
    return this.ormRepository.find({
      where: { status: In(statuses) },
      relations,
      order: { created_at: 'ASC' },
    });
  }

  public async findCanceledSince(date: Date): Promise<Membership[]> {
    return this.ormRepository.find({
      where: { status: 'canceled', canceled_at: MoreThanOrEqual(date) },
      relations,
    });
  }
}

export default MembershipsRepository;
