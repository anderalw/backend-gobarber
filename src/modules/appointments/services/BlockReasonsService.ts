import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import BlockReason from '../infra/typeorm/entities/BlockReason';
import IBlockReasonsRepository from '../repositories/IBlockReasonsRepository';

export const MAX_REASON_LENGTH = 40;

// Cadastro dos motivos de bloqueio (tela de administração). Os bloqueios
// guardam o nome do motivo, então editar ou excluir não mexe neles
@injectable()
class BlockReasonsService {
  constructor(
    @inject('BlockReasonsRepository')
    private blockReasonsRepository: IBlockReasonsRepository,
  ) {}

  public async list(): Promise<BlockReason[]> {
    return this.blockReasonsRepository.findAll();
  }

  public async create(name: string): Promise<BlockReason> {
    const clean = await this.validName(name);

    return this.blockReasonsRepository.create(clean);
  }

  public async update(id: string, name: string): Promise<BlockReason> {
    const reason = await this.find(id);

    reason.name = await this.validName(name, id);

    return this.blockReasonsRepository.save(reason);
  }

  public async delete(id: string): Promise<void> {
    const reason = await this.find(id);

    await this.blockReasonsRepository.delete(reason.id);
  }

  private async find(id: string): Promise<BlockReason> {
    const reason = await this.blockReasonsRepository.findById(id);

    if (!reason) {
      throw new AppError('Motivo não encontrado.', 404);
    }

    return reason;
  }

  // Nome sem espaços sobrando, com tamanho limitado e sem repetir outro
  // motivo (ignorando maiúsculas)
  private async validName(name: string, except_id?: string): Promise<string> {
    const clean = (name || '').trim().replace(/\s+/g, ' ');

    if (!clean) {
      throw new AppError('Informe o nome do motivo.');
    }

    if (clean.length > MAX_REASON_LENGTH) {
      throw new AppError(
        `O nome do motivo pode ter no máximo ${MAX_REASON_LENGTH} caracteres.`,
      );
    }

    const reasons = await this.blockReasonsRepository.findAll();
    const inUse = reasons.some(
      other =>
        other.id !== except_id &&
        other.name.toLowerCase() === clean.toLowerCase(),
    );

    if (inUse) {
      throw new AppError('Já existe um motivo com esse nome.');
    }

    return clean;
  }
}

export default BlockReasonsService;
