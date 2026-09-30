import { randomUUID } from 'crypto';

import IMembershipPaymentsRepository, {
  ICreateMembershipPaymentDTO,
} from '../IMembershipPaymentsRepository';
import MembershipPayment from '../../infra/typeorm/entities/MembershipPayment';
import FakeMembershipsRepository from './FakeMembershipsRepository';

class FakeMembershipPaymentsRepository
  implements IMembershipPaymentsRepository
{
  public payments: MembershipPayment[] = [];

  constructor(private memberships: FakeMembershipsRepository) {}

  public async create(
    data: ICreateMembershipPaymentDTO,
  ): Promise<MembershipPayment> {
    const payment = Object.assign(new MembershipPayment(), data, {
      id: randomUUID(),
      created_at: new Date(Date.now()),
      updated_at: new Date(Date.now()),
    });

    this.payments.push(payment);

    return payment;
  }

  public async findPaidInPeriod(
    start: Date,
    end: Date,
  ): Promise<MembershipPayment[]> {
    const found = this.payments.filter(
      payment => payment.paid_at >= start && payment.paid_at <= end,
    );

    return Promise.all(
      found.map(async payment =>
        Object.assign(payment, {
          membership: await this.memberships.findById(payment.membership_id),
        }),
      ),
    );
  }

  public async findByMembership(
    membership_id: string,
  ): Promise<MembershipPayment[]> {
    return this.payments
      .filter(payment => payment.membership_id === membership_id)
      .sort((a, b) => b.paid_at.getTime() - a.paid_at.getTime());
  }
}

export default FakeMembershipPaymentsRepository;
