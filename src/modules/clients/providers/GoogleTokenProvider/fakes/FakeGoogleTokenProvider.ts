import AppError from '@shared/errors/AppError';
import IGoogleTokenProvider, {
  IGoogleProfile,
} from '../models/IGoogleTokenProvider';

// Nos testes, o "token" é a chave de um perfil cadastrado com addToken
export default class FakeGoogleTokenProvider implements IGoogleTokenProvider {
  private tokens = new Map<string, IGoogleProfile>();

  public enabled = true;

  public addToken(credential: string, profile: IGoogleProfile): void {
    this.tokens.set(credential, profile);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public clientId(): string | null {
    return this.enabled ? 'fake-client-id' : null;
  }

  public async verify(credential: string): Promise<IGoogleProfile> {
    const profile = this.tokens.get(credential);

    if (!profile) {
      throw new AppError(
        'Não foi possível confirmar o login com o Google. Tente de novo.',
        401,
      );
    }

    return profile;
  }
}
