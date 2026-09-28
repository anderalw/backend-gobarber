import findFreeStarts from './findFreeStarts';

// 10/08/2020
const at = (hours: number, minutes = 0): Date =>
  new Date(2020, 7, 10, hours, minutes);
const times = (dates: Date[]): string[] =>
  dates.map(
    date =>
      `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes(),
      ).padStart(2, '0')}`,
  );

describe('findFreeStarts', () => {
  it('should offer starts every 15 minutes and right after appointments', () => {
    const starts = findFreeStarts({
      workStart: at(9),
      workEnd: at(12),
      durationMinutes: 45,
      bufferMinutes: 0,
      // Ocupado das 10:00 às 10:40
      busy: [{ start: at(10), end: at(10, 40) }],
      now: at(8),
    });

    expect(times(starts)).toEqual([
      '09:00',
      '09:15',
      // 09:30 terminaria 10:15, em cima do atendimento
      '10:40',
      '10:45',
      '11:00',
      '11:15',
    ]);
  });

  it('should keep the buffer after the new appointment free', () => {
    const starts = findFreeStarts({
      workStart: at(9),
      workEnd: at(11),
      durationMinutes: 30,
      bufferMinutes: 15,
      busy: [{ start: at(10), end: at(10, 45) }],
      now: at(8),
    });

    // 09:30 + 30 min + 15 de intervalo encostaria às 10:15 no atendimento;
    // 10:45 terminaria às 11:15, depois do expediente
    expect(times(starts)).toEqual(['09:00', '09:15']);
  });

  it('should not offer starts that already passed', () => {
    const starts = findFreeStarts({
      workStart: at(9),
      workEnd: at(10),
      durationMinutes: 30,
      bufferMinutes: 0,
      busy: [],
      now: at(9, 10),
    });

    expect(times(starts)).toEqual(['09:15', '09:30']);
  });
});
