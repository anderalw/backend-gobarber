import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';

// Remove um bloqueio avulso ou uma repetição inteira (todos os dias dela):
// o período volta a aceitar agendamentos
@injectable()
class DeleteTimeBlockService {
  constructor(
    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,
  ) {}

  public async execute(id: string): Promise<void> {
    const block = await this.timeBlocksRepository.findById(id);

    if (block) {
      await this.timeBlocksRepository.delete(block.id);
      return;
    }

    const rule = await this.timeBlocksRepository.findRecurringById(id);

    if (!rule) {
      throw new AppError('Bloqueio não encontrado.', 404);
    }

    await this.timeBlocksRepository.deleteRecurring(rule.id);
  }
}

export default DeleteTimeBlockService;
