import 'reflect-metadata';
import AppError from '@shared/errors/AppError';
import FakeSettingsRepository from '../repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from './AgendaSettingsService';

let agendaSettings: AgendaSettingsService;

describe('AgendaSettings', () => {
  beforeEach(() => {
    agendaSettings = new AgendaSettingsService(new FakeSettingsRepository());
  });

  it('should have no buffer between appointments by default', async () => {
    expect(await agendaSettings.get()).toEqual({ buffer_minutes: 0 });
  });

  it('should save the buffer between appointments', async () => {
    await agendaSettings.update({ buffer_minutes: 15 });

    expect(await agendaSettings.get()).toEqual({ buffer_minutes: 15 });
  });

  it('should not accept an invalid buffer', async () => {
    await Promise.all(
      [-5, 7, 125].map(buffer_minutes =>
        expect(agendaSettings.update({ buffer_minutes })).rejects.toBeInstanceOf(
          AppError,
        ),
      ),
    );
  });
});
