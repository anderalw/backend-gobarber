export default interface ICreateTimeBlockDTO {
  provider_id: string;
  start_date: Date;
  end_date: Date;
  reason: string | null;
  created_by: string | null;
}
