import AppError from '@shared/errors/AppError';
import FakeStorageProvider from '@shared/container/providers/StorageProvider/fakes/FakeStorageProvider';
import FakeSettingsRepository from '../repositories/fakes/FakeSettingsRepository';
import BrandingService, { onColor } from './BrandingService';

let fakeStorageProvider: FakeStorageProvider;
let branding: BrandingService;

describe('Identidade da barbearia', () => {
  beforeEach(() => {
    fakeStorageProvider = new FakeStorageProvider();
    branding = new BrandingService(
      new FakeSettingsRepository(),
      fakeStorageProvider,
    );
    process.env.APP_API_URL = 'http://api.test';
  });

  it('should start with the Pontual name and orange', async () => {
    expect(await branding.get()).toEqual({
      name: 'Pontual',
      primary_color: '#ff9000',
      on_primary_color: '#1b1a1f',
      logo_url: null,
    });
  });

  it('should save the name and the color', async () => {
    const saved = await branding.update({
      name: '  Barbearia   do Zé ',
      primary_color: '#1E6FD9',
    });

    expect(saved).toMatchObject({
      name: 'Barbearia do Zé',
      primary_color: '#1e6fd9',
      // Azul escuro: texto branco por cima
      on_primary_color: '#ffffff',
    });
  });

  it('should not accept an invalid name or color', async () => {
    await expect(
      branding.update({ name: 'A', primary_color: '#ff9000' }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      branding.update({ name: 'Zé', primary_color: 'laranja' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should replace and remove the logo', async () => {
    const deleteFile = jest.spyOn(fakeStorageProvider, 'deleteFile');

    await branding.updateLogo('logo-1.png');
    const second = await branding.updateLogo('logo-2.png');

    expect(second.logo_url).toBe('http://api.test/files/logo-2.png');
    // O logo anterior é apagado
    expect(deleteFile).toHaveBeenCalledWith('logo-1.png');

    expect((await branding.removeLogo()).logo_url).toBeNull();
    expect(deleteFile).toHaveBeenCalledWith('logo-2.png');
  });

  it('should pick a readable text color', () => {
    expect(onColor('#ffffff')).toBe('#1b1a1f');
    expect(onColor('#000000')).toBe('#ffffff');
    expect(onColor('#51cf66')).toBe('#1b1a1f');
    expect(onColor('#7048e8')).toBe('#ffffff');
  });
});
