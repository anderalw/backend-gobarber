import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ISettingsRepository from '../repositories/ISettingsRepository';

const BUFFER_KEY = 'appointment_buffer_minutes';

export interface IAgendaSettings {
  // Intervalo livre após cada atendimento, antes do próximo horário
  buffer_minutes: number;
}

// Configurações da agenda definidas pelo admin
@injectable()
class AgendaSettingsService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,
  ) {}

  public async get(): Promise<IAgendaSettings> {
    const value = await this.settingsRepository.get(BUFFER_KEY);

    // Sem configuração: sem intervalo entre atendimentos
    return { buffer_minutes: value ? Number(value) : 0 };
  }

  public async update({
    buffer_minutes,
  }: IAgendaSettings): Promise<IAgendaSettings> {
    if (
      !Number.isInteger(buffer_minutes) ||
      buffer_minutes < 0 ||
      buffer_minutes > 120 ||
      buffer_minutes % 5 !== 0
    ) {
      throw new AppError(
        'O intervalo deve ser de 0 a 120 minutos, em múltiplos de 5.',
      );
    }

    await this.settingsRepository.set(BUFFER_KEY, String(buffer_minutes));

    return { buffer_minutes };
  }
}

export default AgendaSettingsService;
