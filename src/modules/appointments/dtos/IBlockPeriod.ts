// Um período bloqueado na agenda: um bloqueio avulso ou um dia de um
// bloqueio que se repete
export default interface IBlockPeriod {
  // Id do bloqueio avulso ou da repetição (o mesmo em todos os dias dela)
  id: string;
  provider_id: string;
  start_date: Date;
  end_date: Date;
  reason: string | null;
  // Regra da repetição; null no bloqueio avulso
  recurrence: {
    days_of_week: number[];
    start_time: string;
    end_time: string;
    starts_on: string;
    ends_on: string | null;
  } | null;
}
