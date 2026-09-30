import MembershipPayment from '../infra/typeorm/entities/MembershipPayment';

export type ICreateMembershipPaymentDTO = Pick<
  MembershipPayment,
  | 'membership_id'
  | 'amount_cents'
  | 'payment_method'
  | 'period_start'
  | 'period_end'
  | 'paid_at'
  | 'received_by'
>;

export default interface IMembershipPaymentsRepository {
  create(data: ICreateMembershipPaymentDTO): Promise<MembershipPayment>;
  // Recebidas no período, com a assinatura (cliente e plano)
  findPaidInPeriod(start: Date, end: Date): Promise<MembershipPayment[]>;
  // Da mais recente para a mais antiga
  findByMembership(membership_id: string): Promise<MembershipPayment[]>;
}
