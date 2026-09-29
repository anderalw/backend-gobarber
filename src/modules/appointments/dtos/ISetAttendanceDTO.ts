import {
  Attendance,
  PaymentMethod,
} from '../infra/typeorm/entities/Appointment';

export default interface ISetAttendanceDTO {
  appointment_id: string;
  // null desfaz o registro (volta a "a confirmar")
  attendance: Attendance | null;
  attendance_at: Date | null;
  attendance_by: string | null;
  // Só no atendimento concluído; limpos nos outros casos
  payment_method: PaymentMethod | null;
  paid_cents: number | null;
}
