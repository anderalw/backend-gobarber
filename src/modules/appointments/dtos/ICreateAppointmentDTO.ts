export default interface ICreateAppointmentDTO {
  provider_id: string;
  client_id: string; // <-- Mudou de user_id para client_id
  date: Date;
}