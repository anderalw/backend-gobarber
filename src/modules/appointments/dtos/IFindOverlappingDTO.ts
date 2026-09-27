export default interface IFindOverlappingDTO {
  provider_id: string;
  // Intervalo que o novo agendamento vai ocupar (início até blocked_until)
  start: Date;
  end: Date;
  // Ao remarcar, o próprio agendamento não conta como conflito
  except_appointment_id?: string;
}
