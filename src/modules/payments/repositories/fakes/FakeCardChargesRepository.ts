import { randomUUID } from 'crypto';

import ICardChargesRepository, {
  ICreateCardChargeDTO,
} from '../ICardChargesRepository';
import CardCharge from '../../infra/typeorm/entities/CardCharge';

class FakeCardChargesRepository implements ICardChargesRepository {
  public charges: CardCharge[] = [];

  public async create(data: ICreateCardChargeDTO): Promise<CardCharge> {
    const charge = Object.assign(new CardCharge(), {
      id: randomUUID(),
      status: 'pending',
      external_id: null,
      method: null,
      message: null,
      resolved_at: null,
      created_at: new Date(Date.now()),
      updated_at: new Date(Date.now()),
      ...data,
    });

    this.charges.push(charge);

    return charge;
  }

  public async save(charge: CardCharge): Promise<CardCharge> {
    const index = this.charges.findIndex(item => item.id === charge.id);

    this.charges[index] = charge;

    return charge;
  }

  public async findById(id: string): Promise<CardCharge | undefined> {
    return this.charges.find(charge => charge.id === id);
  }

  public async findPending(): Promise<CardCharge[]> {
    return this.charges.filter(charge => charge.status === 'pending');
  }

  public async findPendingByAppointment(
    appointment_id: string,
  ): Promise<CardCharge | undefined> {
    return this.charges.find(
      charge =>
        charge.appointment_id === appointment_id && charge.status === 'pending',
    );
  }
}

export default FakeCardChargesRepository;
