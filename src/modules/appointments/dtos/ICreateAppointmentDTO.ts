export default interface ICreateAppointmentDTO {
  provider_id: string;
  client_id: string;
  service_id: string;
  price_cents: number;
  date: Date;
  end_date: Date;
  blocked_until: Date;
  // Cliente fixo: série a que o horário pertence
  series_id?: string | null;
  // Clube: incluso no plano / preço normal quando houve benefício
  membership_id?: string | null;
  list_price_cents?: number | null;
}
