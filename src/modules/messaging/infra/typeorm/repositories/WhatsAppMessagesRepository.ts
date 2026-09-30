import {
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import IWhatsAppMessagesRepository, {
  ICreateWhatsAppMessageDTO,
} from '@modules/messaging/repositories/IWhatsAppMessagesRepository';

import WhatsAppMessage from '../entities/WhatsAppMessage';

// 23505 = unique_violation: a mensagem já tinha sido criada
const UNIQUE_VIOLATION = '23505';

// Pendente e ainda válida (sem prazo ou antes do prazo)
const valid = (now: Date) => [
  { status: 'pending' as const, expires_at: IsNull() },
  { status: 'pending' as const, expires_at: MoreThan(now) },
];

class WhatsAppMessagesRepository implements IWhatsAppMessagesRepository {
  private ormRepository: Repository<WhatsAppMessage>;

  constructor() {
    this.ormRepository = dataSource.getRepository(WhatsAppMessage);
  }

  public async create(
    data: ICreateWhatsAppMessageDTO,
  ): Promise<WhatsAppMessage | undefined> {
    try {
      return await this.ormRepository.save(this.ormRepository.create(data));
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === UNIQUE_VIOLATION
      ) {
        return undefined;
      }

      throw err;
    }
  }

  public async save(message: WhatsAppMessage): Promise<WhatsAppMessage> {
    return this.ormRepository.save(message);
  }

  public async findById(id: string): Promise<WhatsAppMessage | undefined> {
    // Sem id o TypeORM 0.3 ignoraria o filtro e traria o primeiro registro
    if (!id) return undefined;

    return (await this.ormRepository.findOneBy({ id })) ?? undefined;
  }

  public async findPending(now: Date): Promise<WhatsAppMessage[]> {
    return this.ormRepository.find({
      where: valid(now),
      order: { created_at: 'ASC' },
    });
  }

  public async countPending(now: Date): Promise<number> {
    return this.ormRepository.count({ where: valid(now) });
  }

  public async findHistory(limit: number): Promise<WhatsAppMessage[]> {
    return this.ormRepository.find({
      where: { status: Not('pending') },
      order: { updated_at: 'DESC' },
      take: limit,
    });
  }

  public async findRetryable(
    maxAttempts: number,
    now: Date,
  ): Promise<WhatsAppMessage[]> {
    return this.ormRepository.find({
      where: [
        {
          status: 'failed',
          attempts: LessThan(maxAttempts),
          expires_at: IsNull(),
        },
        {
          status: 'failed',
          attempts: LessThan(maxAttempts),
          expires_at: MoreThan(now),
        },
      ],
      order: { created_at: 'ASC' },
    });
  }

  public async expire(now: Date): Promise<number> {
    const result = await this.ormRepository.update(
      {
        status: In(['pending', 'failed']),
        expires_at: LessThanOrEqual(now),
      },
      { status: 'expired' },
    );

    return result.affected || 0;
  }
}

export default WhatsAppMessagesRepository;
