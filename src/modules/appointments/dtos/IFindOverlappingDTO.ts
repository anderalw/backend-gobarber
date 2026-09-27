export default interface IFindOverlappingDTO {
  provider_id: string;
  // Intervalo que o novo agendamento vai ocupar (início até blocked_until)
  start: Date;
  end: Date;
}
