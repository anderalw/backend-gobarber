import {
  ChargeMethod,
  ChargeStatus,
} from '../../../infra/typeorm/entities/CardCharge';

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

// Integração com uma operadora de maquininha (Mercado Pago Point, Stone,
// Cielo LIO...). Cada operadora implementa estas operações; o resto do
// sistema não muda
export default interface ITerminalProvider {
  // Identificador salvo na cobrança ('simulator', 'mercadopago'...)
  readonly key: string;
  readonly label: string;
  listDevices(): Promise<ITerminalDevice[]>;
  // Manda a cobrança para a maquininha; devolve o id dela na operadora
  createCharge(data: {
    device_id: string;
    amount_cents: number;
    description: string;
    // Id da nossa cobrança, para a operadora devolver no aviso
    reference: string;
  }): Promise<{ external_id: string }>;
  getStatus(external_id: string): Promise<ITerminalChargeStatus>;
  // Tira a cobrança da tela da maquininha (se ainda não foi paga)
  cancel(external_id: string): Promise<void>;
}
