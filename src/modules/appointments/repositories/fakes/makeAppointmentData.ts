import { addMinutes } from 'date-fns';

import ICreateAppointmentDTO from '@modules/appointments/dtos/ICreateAppointmentDTO';

interface IMakeAppointmentData {
  provider_id: string;
  client_id: string;
  date: Date;
  // Duração do atendimento; sem intervalo depois
  minutes?: number;
}

// Dados de um agendamento para os testes, com os campos calculados
export default function makeAppointmentData({
  provider_id,
  client_id,
  date,
  minutes = 60,
}: IMakeAppointmentData): ICreateAppointmentDTO {
  return {
    provider_id,
    client_id,
    service_id: 'service-id',
    price_cents: 4500,
    date,
    end_date: addMinutes(date, minutes),
    blocked_until: addMinutes(date, minutes),
  };
}
