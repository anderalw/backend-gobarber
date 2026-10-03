// Recortes da lista de clientes
// - inactive: já veio, mas não volta há X dias e não tem horário marcado
// - birthdays: faz aniversário no mês
// - no_shows: já faltou alguma vez
// - club: tem assinatura ativa no clube
// - new: cadastrado nos últimos 30 dias
export type ClientFilter =
  | 'all'
  | 'inactive'
  | 'birthdays'
  | 'no_shows'
  | 'club'
  | 'new';

export type ClientSort =
  | 'name'
  | 'visits'
  | 'no_shows'
  | 'last_visit'
  | 'next_appointment'
  | 'total'
  | 'birthday';

export type SortDirection = 'asc' | 'desc';

export const CLIENT_FILTERS: ClientFilter[] = [
  'all',
  'inactive',
  'birthdays',
  'no_shows',
  'club',
  'new',
];

export const CLIENT_SORTS: ClientSort[] = [
  'name',
  'visits',
  'no_shows',
  'last_visit',
  'next_appointment',
  'total',
  'birthday',
];

export default interface IListClientsDTO {
  search: string;
  filter: ClientFilter;
  sort: ClientSort;
  direction: SortDirection;
  // "Sumidos": sem vir há quantos dias
  inactive_days: number;
  // Mês dos aniversariantes (1 a 12)
  month: number;
  now: Date;
  offset: number;
  limit: number;
}
