// Um campo que a barbearia preenche para conectar a conta do provedor
export interface IWhatsAppCredentialField {
  key: string;
  label: string;
  // Segredo: nunca volta para a tela, só os últimos caracteres
  secret: boolean;
  required: boolean;
  placeholder?: string;
  help?: string;
}

export type IWhatsAppCredentials = Record<string, string>;

// Forma de enviar as mensagens de WhatsApp (envio assistido, API oficial da
// Meta...). Um provedor novo entra implementando isto; as mensagens e as
// telas não mudam
export default interface IWhatsAppProvider {
  // Salvo em cada mensagem ('manual', 'simulator', 'meta'...)
  readonly key: string;
  readonly label: string;
  readonly description: string;
  // false: a mensagem fica na fila para alguém enviar pelo WhatsApp (clique)
  readonly automatic: boolean;
  readonly credentialFields: IWhatsAppCredentialField[];
  // Confere as credenciais (erro com a mensagem para a barbearia)
  verify(credentials: IWhatsAppCredentials): Promise<void>;
  // Só nos automáticos; devolve o id da mensagem no provedor
  send(
    credentials: IWhatsAppCredentials,
    message: { to: string; body: string },
  ): Promise<{ external_id: string }>;
}
