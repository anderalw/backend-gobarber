import { addMinutes, isAfter, isBefore } from 'date-fns';

interface IBusyPeriod {
  start: Date;
  // Fim do atendimento + intervalo (blocked_until)
  end: Date;
}

interface IFindFreeStarts {
  workStart: Date;
  workEnd: Date;
  durationMinutes: number;
  bufferMinutes: number;
  busy: IBusyPeriod[];
  now: Date;
  // Passo da grade de horários candidatos
  stepMinutes?: number;
}

// Todos os inícios possíveis para um serviço, e não só a lista encadeada
// do dia: a cada 15 minutos e logo depois de cada atendimento (quando o
// horário fica livre). Serve para sugerir o horário livre mais próximo de
// um horário escolhido na agenda
export default function findFreeStarts({
  workStart,
  workEnd,
  durationMinutes,
  bufferMinutes,
  busy,
  now,
  stepMinutes = 15,
}: IFindFreeStarts): Date[] {
  const candidates = new Map<number, Date>();

  for (
    let start = workStart;
    !isAfter(addMinutes(start, durationMinutes), workEnd);
    start = addMinutes(start, stepMinutes)
  ) {
    candidates.set(start.getTime(), start);
  }

  busy.forEach(period => {
    candidates.set(period.end.getTime(), period.end);
  });

  return Array.from(candidates.values())
    .filter(start => {
      const end = addMinutes(start, durationMinutes);
      const blockedUntil = addMinutes(end, bufferMinutes);

      return (
        !isBefore(start, workStart) &&
        !isAfter(end, workEnd) &&
        isAfter(start, now) &&
        // Mesma regra do agendamento: o atendimento e o intervalo depois
        // dele não podem encostar em outro
        !busy.some(
          period =>
            isBefore(period.start, blockedUntil) && isAfter(period.end, start),
        )
      );
    })
    .sort((a, b) => a.getTime() - b.getTime());
}
