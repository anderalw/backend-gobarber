import computeAvailableSlots from './computeAvailableSlots';

// 28/09/2026 (segunda-feira), "agora" bem antes do dia
const at = (hour: number, minute = 0): Date =>
  new Date(2026, 8, 28, hour, minute);
const format = (dates: Date[]): string[] =>
  dates.map(
    date =>
      `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes(),
      ).padStart(2, '0')}`,
  );

const base = {
  workStart: at(9),
  workEnd: at(12),
  busy: [],
  now: new Date(2026, 8, 1),
};

describe('computeAvailableSlots', () => {
  it('should chain the slots by duration plus buffer', () => {
    // Cabelo de 45 min com 15 min de intervalo: 9:00, 10:00, 11:00
    const slots = computeAvailableSlots({
      ...base,
      durationMinutes: 45,
      bufferMinutes: 15,
    });

    expect(format(slots)).toEqual(['09:00', '10:00', '11:00']);
  });

  it('should only offer slots whose service fits in the work hours', () => {
    // 45 min sem intervalo: 11:15 terminaria às 12:00 (cabe), 12:00 não
    const slots = computeAvailableSlots({
      ...base,
      durationMinutes: 45,
      bufferMinutes: 0,
    });

    expect(format(slots)).toEqual(['09:00', '09:45', '10:30', '11:15']);
  });

  it('should restart right after an existing appointment and its buffer', () => {
    // Já existe um agendamento das 9:30 às 10:00, ocupado até 10:15
    const slots = computeAvailableSlots({
      ...base,
      durationMinutes: 30,
      bufferMinutes: 15,
      busy: [{ start: at(9, 30), end: at(10, 15) }],
    });

    // 9:00 terminaria 9:30 + 15 = 9:45 > 9:30: conflito, pula para 10:15
    expect(format(slots)).toEqual(['10:15', '11:00']);
  });

  it('should not offer slots that already started', () => {
    const slots = computeAvailableSlots({
      ...base,
      durationMinutes: 60,
      bufferMinutes: 0,
      now: at(10, 20),
    });

    expect(format(slots)).toEqual(['11:00']);
  });

  it('should return no slots when the service is longer than the work hours', () => {
    const slots = computeAvailableSlots({
      ...base,
      durationMinutes: 240,
      bufferMinutes: 0,
    });

    expect(slots).toEqual([]);
  });
});
