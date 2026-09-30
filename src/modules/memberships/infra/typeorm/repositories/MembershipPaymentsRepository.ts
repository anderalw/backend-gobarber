import { Between, Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import IMembershipPaymentsRepository, {
  ICreateMembershipPaymentDTO,
} from '@modules/memberships/repositories/IMembershipPaymentsRepository';

import MembershipPayment from '../entities/MembershipPayment';

class MembershipPaymentsRepository implements IMembershipPaymentsRepository {
  private ormRepository: Repository<MembershipPayment>;

  constructor() {
    this.ormRepository = dataSource.getRepository(MembershipPayment);
  }

  public async create(
    data: ICreateMembershipPaymentDTO,
  ): Promise<MembershipPayment> {
    return this.ormRepository.save(this.ormRepository.create(data));
  }

  public async findPaidInPeriod(
    start: Date,
    end: Date,
  ): Promise<MembershipPayment[]> {
    return this.ormRepository.find({
      where: { paid_at: Between(start, end) },
      relations: ['membership', 'membership.client', 'membership.plan'],
      order: { paid_at: 'ASC' },
    });
  }

  public async findByMembership(
    membership_id: string,
  ): Promise<MembershipPayment[]> {
    if (!membership_id) return [];

    return this.ormRepository.find({
      where: { membership_id },
      order: { paid_at: 'DESC' },
    });
  }
}

export default MembershipPaymentsRepository;
