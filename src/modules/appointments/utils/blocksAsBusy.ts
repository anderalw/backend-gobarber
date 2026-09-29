import { addMinutes } from 'date-fns';

import IBlockPeriod from '../dtos/IBlockPeriod';

// Bloqueios no formato dos períodos ocupados usados no cálculo de horários.
// O bloqueio funciona como o fim do expediente: o atendimento precisa
// terminar antes dele, mas o intervalo depois do atendimento pode avançar
// sobre ele. Como o cálculo compara os períodos ocupados com o fim do
// atendimento somado ao intervalo, o início do bloqueio é adiado pelo mesmo
// intervalo
export default function blocksAsBusy(
  blocks: IBlockPeriod[],
  bufferMinutes: number,
): Array<{ start: Date; end: Date }> {
  return blocks.map(block => ({
    start: addMinutes(block.start_date, bufferMinutes),
    end: block.end_date,
  }));
}
