import IClientSummaryDTO from '@modules/appointments/dtos/IClientSummaryDTO';

// Cliente sem nenhum agendamento ainda
export default function emptySummary(client_id: string): IClientSummaryDTO {
  return {
    client_id,
    completed: 0,
    no_shows: 0,
    recent_no_shows: 0,
    canceled: 0,
    total_cents: 0,
    last_visit: null,
    next_appointment: null,
  };
}
