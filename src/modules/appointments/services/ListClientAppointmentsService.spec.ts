import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import ListClientAppointmentsService from './ListClientAppointmentsService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let listClientAppointments: ListClientAppointmentsService;

describe('ListClientAppointments', () => {
  beforeEach(() => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    listClientAppointments = new ListClientAppointmentsService(
      fakeAppointmentsRepository,
    );

    // "Agora" é 10/08/2020 às 12h
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 10, 12).getTime();
    });
  });

  it("should list the client's upcoming appointments, telling which can still be changed", async () => {
    const book = (client_id: string, date: Date) =>
      fakeAppointmentsRepository.create(
        makeAppointmentData({ provider_id: 'provider', client_id, date }),
      );

    const tomorrow = await book('client', new Date(2020, 7, 11, 10));
    const inOneHour = await book('client', new Date(2020, 7, 10, 13));
    await book('client', new Date(2020, 7, 9, 10)); // já passou
    await book('other-client', new Date(2020, 7, 11, 11)); // de outra pessoa
    const canceled = await book('client', new Date(2020, 7, 12, 10));
    canceled.canceled_at = new Date(2020, 7, 10, 9);

    const appointments = await listClientAppointments.execute('client');

    expect(appointments.map(item => item.id)).toEqual([
      inOneHour.id,
      tomorrow.id,
    ]);
    // Menos de 2 horas de antecedência: só a barbearia pode alterar
    expect(appointments[0].can_change).toBe(false);
    expect(appointments[1].can_change).toBe(true);
  });

  it('should list the past appointments, newest first, without canceled', async () => {
    const make = async (date: Date) =>
      fakeAppointmentsRepository.create(
        makeAppointmentData({
          provider_id: 'joao',
          client_id: 'cliente',
          date,
        }),
      );

    const older = await make(new Date(2020, 0, 10, 10));
    const newer = await make(new Date(2020, 0, 20, 10));
    const canceled = await make(new Date(2020, 0, 15, 10));
    canceled.canceled_at = new Date(2020, 0, 14);
    newer.attendance = 'completed';
    await make(new Date(2099, 0, 10, 10));

    const history = await listClientAppointments.history('cliente');

    expect(history.map(item => item.id)).toEqual([newer.id, older.id]);
    expect(history[0].attendance).toBe('completed');
  });
});
