// Histórico resumido de um cliente (todas as datas), para os indicadores
export default interface IClientVisitsDTO {
  client_id: string;
  // Primeiro e último atendimento concluído (null: nunca foi atendido)
  first_visit: Date | null;
  last_visit: Date | null;
  visits: number;
  // Recebido nos atendimentos concluídos, em centavos
  total_cents: number;
  // Tem horário marcado daqui para frente
  has_upcoming: boolean;
}
