// Dados da conta Google confirmados pelo próprio Google
export interface IGoogleProfile {
  // Id da conta no Google (não muda, mesmo se o e-mail mudar)
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
}

export default interface IGoogleTokenProvider {
  // false quando o login com Google não está configurado (sem client id)
  isEnabled(): boolean;
  clientId(): string | null;
  // Confere a assinatura e o destino do token do botão do Google; erro se
  // for inválido ou vencido
  verify(credential: string): Promise<IGoogleProfile>;
}
