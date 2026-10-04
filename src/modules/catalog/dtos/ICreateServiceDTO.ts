export default interface ICreateServiceDTO {
  name: string;
  duration_minutes: number;
  price_cents: number;
  // Sinal para garantir o horário (null = sem sinal; omitido = não muda)
  deposit_cents?: number | null;
  position?: number;
}
