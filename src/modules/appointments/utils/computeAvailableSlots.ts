import { addMinutes, isAfter, isBefore, max } from 'date-fns';

interface IBusyPeriod {
  start: Date;
  // Fim do atendimento + intervalo (blocked_until)
  end: Date;
}

interface IComputeAvailableSlots {
  // Início e fim do expediente do barbeiro no dia
  workStart: Date;
  workEnd: Date;
  durationMinutes: number;
  bufferMinutes: number;
  busy: IBusyPeriod[];
  now: Date;
}

// Horários em que um serviço pode começar. Os horários são encadeados a
// partir do início do expediente: cada um começa quando o anterior termina,
// somado o intervalo entre atendimentos (ex: 45 min + 15 = 9:00, 10:00...).
// Se houver um agendamento no caminho, o próximo horário começa logo que ele
// termina (com o intervalo). O atendimento precisa caber no expediente; o
// intervalo depois do último pode passar do fim.
export default function computeAvailableSlots({
  workStart,
  workEnd,
  durationMinutes,
  bufferMinutes,
  busy,
  now,
}: IComputeAvailableSlots): Date[] {
  const slots: Date[] = [];
  let start = workStart;

  while (!isAfter(addMinutes(start, durationMinutes), workEnd)) {
    const slotStart = start;
    const blockedUntil = addMinutes(slotStart, durationMinutes + bufferMinutes);

    const conflicts = busy.filter(
      period =>
        isBefore(period.start, blockedUntil) && isAfter(period.end, slotStart),
    );

    if (conflicts.length > 0) {
      start = max(conflicts.map(period => period.end));
    } else {
      // Horários que já começaram não são oferecidos
      if (isAfter(start, now)) {
        slots.push(start);
      }

      start = blockedUntil;
    }
  }

  return slots;
}
