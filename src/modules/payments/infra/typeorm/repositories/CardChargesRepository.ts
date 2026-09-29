import { Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import ICardChargesRepository, {
  ICreateCardChargeDTO,
} from '@modules/payments/repositories/ICardChargesRepository';

import CardCharge from '../entities/CardCharge';

class CardChargesRepository implements ICardChargesRepository {
  private ormRepository: Repository<CardCharge>;

  constructor() {
    this.ormRepository = dataSource.getRepository(CardCharge);
  }

  public async create(data: ICreateCardChargeDTO): Promise<CardCharge> {
    const charge = this.ormRepository.create({ ...data, status: 'pending' });

    return this.ormRepository.save(charge);
  }

  public async save(charge: CardCharge): Promise<CardCharge> {
    return this.ormRepository.save(charge);
  }

  public async findById(id: string): Promise<CardCharge | undefined> {
    // Sem id o TypeORM 0.3 ignoraria o filtro e traria o primeiro registro
    if (!id) return undefined;

    return (await this.ormRepository.findOneBy({ id })) ?? undefined;
  }

  public async findPending(): Promise<CardCharge[]> {
    return this.ormRepository.find({
      where: { status: 'pending' },
      order: { created_at: 'ASC' },
    });
  }

  public async findPendingByAppointment(
    appointment_id: string,
  ): Promise<CardCharge | undefined> {
    if (!appointment_id) return undefined;

    return (
      (await this.ormRepository.findOneBy({
        appointment_id,
        status: 'pending',
      })) ?? undefined
    );
  }
}

export default CardChargesRepository;
