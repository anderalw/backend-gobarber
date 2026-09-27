// Expediente de um barbeiro num dia, a partir dos horários 'HH:mm'
export default function workWindow(
  day: Date,
  schedule: { start_time: string; end_time: string },
): { workStart: Date; workEnd: Date } {
  const at = (time: string): Date => {
    const [hours, minutes] = time.split(':').map(Number);

    return new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      hours,
      minutes,
    );
  };

  return { workStart: at(schedule.start_time), workEnd: at(schedule.end_time) };
}
