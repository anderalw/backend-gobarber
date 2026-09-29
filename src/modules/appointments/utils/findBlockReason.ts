import AppError from '@shared/errors/AppError';
import IBlockReasonsRepository from '../repositories/IBlockReasonsRepository';

// Nome do motivo escolhido para um bloqueio (obrigatório e cadastrado)
export default async function findBlockReason(
  blockReasonsRepository: IBlockReasonsRepository,
  reason_id: string,
): Promise<string> {
  const reason = reason_id
    ? await blockReasonsRepository.findById(reason_id)
    : undefined;

  if (!reason) {
    throw new AppError('Escolha o motivo do bloqueio.');
  }

  return reason.name;
}
