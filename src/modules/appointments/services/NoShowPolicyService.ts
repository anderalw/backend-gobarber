import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';

const ALERT_KEY = 'no_show_alert_threshold';
const BLOCK_KEY = 'no_show_block_online';

// Sem configuração: alerta a partir de 2 faltas, sem bloquear o site
const DEFAULT_THRESHOLD = 2;

export interface INoShowPolicy {
  // Faltas nos últimos agendamentos a partir das quais o cliente aparece
  // com alerta na agenda (0 = sem alerta)
  alert_threshold: number;
  // Cliente com alerta só agenda pela barbearia, não pelo site
  block_online: boolean;
}

// As faltas contam entre os últimos 10 agendamentos que já passaram:
// quem volta a comparecer sai do alerta, e o cliente fiel que falta de vez
// em quando não é punido
export const RECENT_APPOINTMENTS = 10;

export function hasNoShowAlert(
  recentNoShows: number,
  policy: INoShowPolicy,
): boolean {
  return policy.alert_threshold > 0 && recentNoShows >= policy.alert_threshold;
}

// Política de faltas definida pelo admin
@injectable()
class NoShowPolicyService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,
  ) {}

  public async get(): Promise<INoShowPolicy> {
    const [threshold, block] = await Promise.all([
      this.settingsRepository.get(ALERT_KEY),
      this.settingsRepository.get(BLOCK_KEY),
    ]);

    return {
      alert_threshold:
        threshold === undefined ? DEFAULT_THRESHOLD : Number(threshold),
      block_online: block === 'true',
    };
  }

  public async update({
    alert_threshold,
    block_online,
  }: INoShowPolicy): Promise<INoShowPolicy> {
    if (
      !Number.isInteger(alert_threshold) ||
      alert_threshold < 0 ||
      alert_threshold > 10
    ) {
      throw new AppError('O número de faltas deve ser de 0 a 10.');
    }

    await Promise.all([
      this.settingsRepository.set(ALERT_KEY, String(alert_threshold)),
      this.settingsRepository.set(
        BLOCK_KEY,
        String(alert_threshold > 0 && block_online),
      ),
    ]);

    return this.get();
  }

  // Agendamento feito pelo próprio cliente no site
  public async ensureCanBookOnline(client_id: string): Promise<void> {
    const policy = await this.get();

    if (!policy.block_online || policy.alert_threshold === 0) return;

    const now = new Date(Date.now());
    const [summary] = await this.appointmentsRepository.summarizeByClients(
      [client_id],
      now,
      RECENT_APPOINTMENTS,
    );

    if (summary && hasNoShowAlert(summary.recent_no_shows, policy)) {
      throw new AppError(
        'Não é possível agendar pelo site. Entre em contato com a equipe para marcar o seu horário.',
        403,
      );
    }
  }
}

export default NoShowPolicyService;
