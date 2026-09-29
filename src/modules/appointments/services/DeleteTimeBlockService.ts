import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';

// Remove um bloqueio: o período volta a aceitar agendamentos
@injectable()
class DeleteTimeBlockService {
  constructor(
    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,
  ) {}

  public async execute(id: string): Promise<void> {
    const block = await this.timeBlocksRepository.findById(id);

    if (!block) {
      throw new AppError('Bloqueio não encontrado.', 404);
    }

    await this.timeBlocksRepository.delete(block.id);
  }
}

export default DeleteTimeBlockService;
