import AppError from '@shared/errors/AppError';
import FakeStorageProvider from '@shared/container/providers/StorageProvider/fakes/FakeStorageProvider';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeSettingsRepository from '../repositories/fakes/FakeSettingsRepository';
import FakeServicesRepository from '../repositories/fakes/FakeServicesRepository';
import SiteService, { DEFAULT_TAGLINE, instagramHandle } from './SiteService';

let fakeUsersRepository: FakeUsersRepository;
let fakeSchedulesRepository: FakeProviderSchedulesRepository;
let fakeServicesRepository: FakeServicesRepository;
let fakeStorageProvider: FakeStorageProvider;
let site: SiteService;

describe('Site da barbearia', () => {
  beforeEach(() => {
    fakeUsersRepository = new FakeUsersRepository();
    fakeSchedulesRepository = new FakeProviderSchedulesRepository();
    fakeServicesRepository = new FakeServicesRepository();
    fakeStorageProvider = new FakeStorageProvider();

    site = new SiteService(
      new FakeSettingsRepository(),
      fakeStorageProvider,
      fakeServicesRepository,
      fakeUsersRepository,
      fakeSchedulesRepository,
    );

    process.env.APP_API_URL = 'http://api.test';
  });

  it('should show the services, the team and the opening hours', async () => {
    const carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });
    const ana = await fakeUsersRepository.create({
      name: 'Ana',
      email: 'ana@example.test',
      password: '123456',
    });
    const antigo = await fakeUsersRepository.create({
      name: 'Antigo',
      email: 'antigo@example.test',
      password: '123456',
    });
    antigo.active = false;
    ana.avatar = 'ana.png';

    // Segunda: Carlos 09–18 e Ana 10–20; sábado só Carlos; o desativado
    // atendia no domingo (não conta)
    await fakeSchedulesRepository.replaceByProviderId(carlos.id, [
      { day_of_week: 1, start_time: '09:00', end_time: '18:00' },
      { day_of_week: 6, start_time: '08:00', end_time: '12:00' },
    ]);
    await fakeSchedulesRepository.replaceByProviderId(ana.id, [
      { day_of_week: 1, start_time: '10:00', end_time: '20:00' },
    ]);
    await fakeSchedulesRepository.replaceByProviderId(antigo.id, [
      { day_of_week: 0, start_time: '09:00', end_time: '12:00' },
    ]);

    const corte = await fakeServicesRepository.create({
      name: 'Corte',
      duration_minutes: 30,
      price_cents: 4500,
    });
    const inativo = await fakeServicesRepository.create({
      name: 'Pigmentação',
      duration_minutes: 60,
      price_cents: 9000,
    });
    inativo.active = false;

    const result = await site.getSite();

    expect(result.tagline).toBe(DEFAULT_TAGLINE);
    expect(result.services.map(item => item.id)).toEqual([corte.id]);
    expect(result.team).toEqual([
      { id: ana.id, name: 'Ana', avatar_url: 'http://api.test/files/ana.png' },
      { id: carlos.id, name: 'Carlos', avatar_url: null },
    ]);
    expect(result.hours[0]).toBeNull();
    expect(result.hours[1]).toEqual({
      day_of_week: 1,
      open: '09:00',
      close: '20:00',
    });
    expect(result.hours[6]).toMatchObject({ open: '08:00', close: '12:00' });
  });

  it('should save the page content, cleaning the contacts', async () => {
    const content = await site.updateContent({
      tagline: '  O melhor corte   da cidade ',
      about: 'Desde 2010.',
      address: 'Rua das Flores, 123 - Centro',
      whatsapp: '(11) 99999-0000',
      instagram: 'https://www.instagram.com/barbeariadoze/',
    });

    expect(content).toMatchObject({
      tagline: 'O melhor corte da cidade',
      whatsapp: '11999990000',
      instagram: 'barbeariadoze',
    });
  });

  it('should reject an invalid WhatsApp or Instagram', async () => {
    await expect(
      site.updateContent({ whatsapp: '9999' }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      site.updateContent({ instagram: 'barbearia do zé' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should replace and remove the cover photo', async () => {
    const deleteFile = jest.spyOn(fakeStorageProvider, 'deleteFile');

    await site.updateCover('capa-1.jpg');
    const second = await site.updateCover('capa-2.jpg');

    expect(second.cover_url).toBe('http://api.test/files/capa-2.jpg');
    expect(deleteFile).toHaveBeenCalledWith('capa-1.jpg');
    expect((await site.removeCover()).cover_url).toBeNull();
  });

  it('should accept the Instagram as @user, user or link', () => {
    expect(instagramHandle('@ze.barber')).toBe('ze.barber');
    expect(instagramHandle('ze.barber')).toBe('ze.barber');
    expect(instagramHandle('https://instagram.com/abc?igsh=1')).toBe('abc');
  });
});
