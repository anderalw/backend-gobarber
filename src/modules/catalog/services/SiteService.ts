// Sem entidades do TypeORM (que carregam o polyfill), o tsyringe precisa dele
import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import uploadConfig from '@config/upload';
import IStorageProvider from '@shared/container/providers/StorageProvider/models/IStorageProvider';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import ISettingsRepository from '../repositories/ISettingsRepository';
import IServicesRepository from '../repositories/IServicesRepository';

const KEYS = {
  tagline: 'site_tagline',
  about: 'site_about',
  address: 'site_address',
  whatsapp: 'site_whatsapp',
  instagram: 'site_instagram',
  cover: 'site_cover',
};

export const DEFAULT_TAGLINE = 'Cortes, barbas e tratamentos com hora marcada.';

export interface ISiteContent {
  // Frase de destaque da capa
  tagline: string;
  // Texto "sobre a barbearia" (vazio: a seção não aparece)
  about: string;
  address: string;
  // Só números, com DDD (ex: 11999990000)
  whatsapp: string;
  // Só o usuário, sem @
  instagram: string;
  // Foto da capa (null: a foto padrão do site)
  cover_url: string | null;
}

export interface ISite extends ISiteContent {
  services: Array<{
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number;
  }>;
  team: Array<{ id: string; name: string; avatar_url: string | null }>;
  // Um item por dia da semana (0 = domingo): do começo do expediente mais
  // cedo ao fim do mais tarde; null = fechado
  hours: Array<{ day_of_week: number; open: string; close: string } | null>;
}

function fileUrl(filename: string): string {
  return uploadConfig.driver === 's3'
    ? `https://${uploadConfig.config.aws.bucket}.s3.amazonaws.com/${filename}`
    : `${process.env.APP_API_URL}/files/${filename}`;
}

// Aceita "@barbearia", "barbearia" ou o link do perfil
export function instagramHandle(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .replace(/\?.*$/, '');
}

// Site da barbearia (página inicial): o conteúdo que o admin escreve e o
// que vem do sistema (serviços, equipe e horários de funcionamento)
@injectable()
class SiteService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject('StorageProvider')
    private storageProvider: IStorageProvider,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,
  ) {}

  public async getContent(): Promise<ISiteContent> {
    const [tagline, about, address, whatsapp, instagram, cover] =
      await Promise.all(
        [
          KEYS.tagline,
          KEYS.about,
          KEYS.address,
          KEYS.whatsapp,
          KEYS.instagram,
          KEYS.cover,
        ].map(key => this.settingsRepository.get(key)),
      );

    return {
      tagline: tagline || DEFAULT_TAGLINE,
      about: about || '',
      address: address || '',
      whatsapp: whatsapp || '',
      instagram: instagram || '',
      cover_url: cover ? fileUrl(cover) : null,
    };
  }

  public async getSite(): Promise<ISite> {
    const [content, services, users, schedules] = await Promise.all([
      this.getContent(),
      this.servicesRepository.findAll({ only_active: true }),
      this.usersRepository.findAllProviders({}),
      Promise.all(
        [0, 1, 2, 3, 4, 5, 6].map(day =>
          this.providerSchedulesRepository.findByDayOfWeek(day),
        ),
      ),
    ]);

    const activeIds = new Set(users.map(user => user.id));

    return {
      ...content,
      services: services.map(service => ({
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes,
        price_cents: service.price_cents,
      })),
      team: users
        .map(user => ({
          id: user.id,
          name: user.name,
          // Sem foto enviada: o site mostra as iniciais
          avatar_url: user.avatar ? fileUrl(user.avatar) : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      hours: schedules.map((list, day_of_week) => {
        const working = list.filter(item => activeIds.has(item.provider_id));

        if (working.length === 0) return null;

        return {
          day_of_week,
          open: working.map(item => item.start_time).sort()[0],
          close: working
            .map(item => item.end_time)
            .sort()
            .reverse()[0],
        };
      }),
    };
  }

  public async updateContent(data: {
    tagline?: string | null;
    about?: string | null;
    address?: string | null;
    whatsapp?: string | null;
    instagram?: string | null;
  }): Promise<ISiteContent> {
    const tagline = (data.tagline || '').trim().replace(/\s+/g, ' ');
    const about = (data.about || '').trim();
    const address = (data.address || '').trim().replace(/\s+/g, ' ');
    const whatsapp = (data.whatsapp || '').replace(/\D/g, '');
    const instagram = instagramHandle(data.instagram || '');

    if (tagline.length > 120) {
      throw new AppError('A frase de destaque pode ter até 120 caracteres.');
    }

    if (about.length > 1000) {
      throw new AppError('O texto "sobre" pode ter até 1000 caracteres.');
    }

    if (address.length > 200) {
      throw new AppError('O endereço pode ter até 200 caracteres.');
    }

    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) {
      throw new AppError('Informe o WhatsApp com DDD. Ex: (11) 99999-0000');
    }

    if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
      throw new AppError('Informe o usuário do Instagram. Ex: @barbearia');
    }

    await Promise.all([
      this.settingsRepository.set(KEYS.tagline, tagline),
      this.settingsRepository.set(KEYS.about, about),
      this.settingsRepository.set(KEYS.address, address),
      this.settingsRepository.set(KEYS.whatsapp, whatsapp),
      this.settingsRepository.set(KEYS.instagram, instagram),
    ]);

    return this.getContent();
  }

  // filename: arquivo já recebido na pasta temporária
  public async updateCover(filename: string): Promise<ISiteContent> {
    const previous = await this.settingsRepository.get(KEYS.cover);
    const saved = await this.storageProvider.saveFile(filename);

    await this.settingsRepository.set(KEYS.cover, saved);

    if (previous) {
      await this.storageProvider.deleteFile(previous).catch(() => undefined);
    }

    return this.getContent();
  }

  public async removeCover(): Promise<ISiteContent> {
    const previous = await this.settingsRepository.get(KEYS.cover);

    if (previous) {
      await this.settingsRepository.set(KEYS.cover, '');
      await this.storageProvider.deleteFile(previous).catch(() => undefined);
    }

    return this.getContent();
  }
}

export default SiteService;
