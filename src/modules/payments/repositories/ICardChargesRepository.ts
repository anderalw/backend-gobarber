import CardCharge from '../infra/typeorm/entities/CardCharge';

export type ICreateCardChargeDTO = Pick<
  CardCharge,
  | 'appointment_id'
  | 'provider'
  | 'device_id'
  | 'device_name'
  | 'amount_cents'
  | 'created_by'
>;

export default interface ICardChargesRepository {
  create(data: ICreateCardChargeDTO): Promise<CardCharge>;
  save(charge: CardCharge): Promise<CardCharge>;
  findById(id: string): Promise<CardCharge | undefined>;
  // Cobranças ainda aguardando a maquininha (a tarefa periódica confere)
  findPending(): Promise<CardCharge[]>;
  findPendingByAppointment(
    appointment_id: string,
  ): Promise<CardCharge | undefined>;
}
