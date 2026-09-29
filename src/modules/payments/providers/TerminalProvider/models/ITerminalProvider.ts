import {
  ChargeMethod,
  ChargeStatus,
} from '../../../infra/typeorm/entities/CardCharge';

// Aparelho na conta da operadora (id dela e o nome que ela devolve)
export interface ITerminalDevice {
  id: string;
  name: string;
}

export interface ITerminalChargeStatus {
  status: ChargeStatus;
  // Quando aprovada: como foi pago e quanto entrou
  method?: ChargeMethod;
  paid_cents?: number;
  // Motivo da recusa, por exemplo
  message?: string;
}

// Um campo que a barbearia preenche para conectar a conta da operadora
export interface ITerminalCredentialField {
  key: string;
  label: string;
  // Segredo: nunca volta para a tela, só os últimos caracteres
  secret: boolean;
  required: boolean;
  placeholder?: string;
  help?: string;
}

// Valores dos campos acima, na conta da barbearia
export type ITerminalCredentials = Record<string, string>;

// Integração com uma operadora de maquininha (Mercado Pago Point, Stone,
// Cielo LIO...). Cada operadora implementa estas operações; o resto do
// sistema não muda
export default interface ITerminalProvider {
  // Identificador salvo na cobrança ('simulator', 'mercadopago'...)
  readonly key: string;
  readonly label: string;
  // O que pedir para conectar a conta e onde a barbearia encontra
  readonly credentialFields: ITerminalCredentialField[];
  readonly setupHelp: string;
  // Como o aparelho é identificado na operadora ("Número de série"...)
  readonly deviceIdLabel: string;
  readonly deviceIdHelp: string;
  // Confere as credenciais (erro com a mensagem para a barbearia)
  verify(credentials: ITerminalCredentials): Promise<void>;
  // Aparelhos vinculados à conta, para facilitar o cadastro
  listDevices(credentials: ITerminalCredentials): Promise<ITerminalDevice[]>;
  // Manda a cobrança para a maquininha; devolve o id dela na operadora
  createCharge(
    credentials: ITerminalCredentials,
    data: {
      device_id: string;
      amount_cents: number;
      description: string;
      // Id da nossa cobrança, para a operadora devolver no aviso
      reference: string;
    },
  ): Promise<{ external_id: string }>;
  getStatus(
    credentials: ITerminalCredentials,
    external_id: string,
  ): Promise<ITerminalChargeStatus>;
  // Tira a cobrança da tela da maquininha (se ainda não foi paga)
  cancel(credentials: ITerminalCredentials, external_id: string): Promise<void>;
}
