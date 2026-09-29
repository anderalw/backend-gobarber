// Resumo do histórico de um cliente na barbearia
export default interface IClientSummaryDTO {
  client_id: string;
  // Atendimentos concluídos
  completed: number;
  // Faltas registradas: todas e as dos últimos agendamentos (os N mais
  // recentes que já passaram, sem contar cancelados)
  no_shows: number;
  recent_no_shows: number;
  canceled: number;
  // Soma dos atendimentos concluídos, em centavos
  total_cents: number;
  // Último atendimento concluído
  last_visit: Date | null;
  // Próximo agendamento ativo
  next_appointment: Date | null;
}
