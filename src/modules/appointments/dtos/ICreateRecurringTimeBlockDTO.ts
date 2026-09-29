export default interface ICreateRecurringTimeBlockDTO {
  provider_id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  starts_on: string;
  ends_on: string | null;
  reason: string | null;
  created_by: string | null;
}
