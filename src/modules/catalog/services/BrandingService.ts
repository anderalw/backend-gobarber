// Sem entidades do TypeORM (que carregam o polyfill), o tsyringe precisa dele
import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import uploadConfig from '@config/upload';
import IStorageProvider from '@shared/container/providers/StorageProvider/models/IStorageProvider';
import { apiUrl } from '@shared/tenancy/hosts';
import ISettingsRepository from '../repositories/ISettingsRepository';

const NAME_KEY = 'shop_name';
const COLOR_KEY = 'shop_primary_color';
const LOGO_KEY = 'shop_logo';

export const DEFAULT_NAME = 'Pontual';
export const DEFAULT_COLOR = '#ff9000';

export interface IBranding {
  name: string;
  // '#rrggbb'
  primary_color: string;
  // Texto legível sobre a cor principal (escuro ou branco)
  on_primary_color: string;
  logo_url: string | null;
}

// Cor do texto sobre a cor principal: escuro em cores claras, branco nas
// escuras (luminância relativa, como no WCAG)
export function onColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(index => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;

    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.35 ? '#1b1a1f' : '#ffffff';
}

function fileUrl(filename: string): string {
  return uploadConfig.driver === 's3'
    ? `https://${uploadConfig.config.aws.bucket}.s3.amazonaws.com/${filename}`
    : `${apiUrl()}/files/${filename}`;
}

// Identidade da barbearia (nome, cor e logo), definida pelo admin e usada
// no site, no painel e nos e-mails
@injectable()
class BrandingService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject('StorageProvider')
    private storageProvider: IStorageProvider,
  ) {}

  public async get(): Promise<IBranding> {
    const [name, color, logo] = await Promise.all([
      this.settingsRepository.get(NAME_KEY),
      this.settingsRepository.get(COLOR_KEY),
      this.settingsRepository.get(LOGO_KEY),
    ]);

    const primary = color || DEFAULT_COLOR;

    return {
      name: name || DEFAULT_NAME,
      primary_color: primary,
      on_primary_color: onColor(primary),
      logo_url: logo ? fileUrl(logo) : null,
    };
  }

  public async update({
    name,
    primary_color,
  }: {
    name: string;
    primary_color: string;
  }): Promise<IBranding> {
    const cleanName = name.trim().replace(/\s+/g, ' ');

    if (cleanName.length < 2 || cleanName.length > 40) {
      throw new AppError('O nome deve ter de 2 a 40 caracteres.');
    }

    if (!/^#[0-9a-f]{6}$/i.test(primary_color)) {
      throw new AppError('Escolha uma cor válida (ex: #ff9000).');
    }

    await Promise.all([
      this.settingsRepository.set(NAME_KEY, cleanName),
      this.settingsRepository.set(COLOR_KEY, primary_color.toLowerCase()),
    ]);

    return this.get();
  }

  // filename: arquivo já recebido na pasta temporária
  public async updateLogo(filename: string): Promise<IBranding> {
    const previous = await this.settingsRepository.get(LOGO_KEY);
    const saved = await this.storageProvider.saveFile(filename);

    await this.settingsRepository.set(LOGO_KEY, saved);

    if (previous) {
      await this.storageProvider.deleteFile(previous).catch(() => undefined);
    }

    return this.get();
  }

  public async removeLogo(): Promise<IBranding> {
    const previous = await this.settingsRepository.get(LOGO_KEY);

    if (previous) {
      await this.settingsRepository.set(LOGO_KEY, '');
      await this.storageProvider.deleteFile(previous).catch(() => undefined);
    }

    return this.get();
  }
}

export default BrandingService;
