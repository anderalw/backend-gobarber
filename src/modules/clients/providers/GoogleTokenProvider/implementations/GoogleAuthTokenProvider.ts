import { OAuth2Client } from 'google-auth-library';

import AppError from '@shared/errors/AppError';
import IGoogleTokenProvider, {
  IGoogleProfile,
} from '../models/IGoogleTokenProvider';

// Valida o token do botão "Continuar com o Google" com as chaves públicas
// do Google. O client id vem do .env (GOOGLE_CLIENT_ID)
export default class GoogleAuthTokenProvider implements IGoogleTokenProvider {
  private client = new OAuth2Client();

  public isEnabled(): boolean {
    return !!process.env.GOOGLE_CLIENT_ID;
  }

  public clientId(): string | null {
    return process.env.GOOGLE_CLIENT_ID || null;
  }

  public async verify(credential: string): Promise<IGoogleProfile> {
    const audience = this.clientId();

    if (!audience) {
      throw new AppError('O login com Google não está configurado.', 400);
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience,
      });
      const payload = ticket.getPayload();

      if (!payload || !payload.sub || !payload.email) {
        throw new Error('sem dados');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: !!payload.email_verified,
        name: payload.name || payload.email.split('@')[0],
      };
    } catch {
      throw new AppError(
        'Não foi possível confirmar o login com o Google. Tente de novo.',
        401,
      );
    }
  }
}
