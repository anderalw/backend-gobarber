export default interface IFindTimeBlocksInRangeDTO {
  // Sem barbeiro: bloqueios de todos
  provider_id?: string;
  start: Date;
  end: Date;
}
