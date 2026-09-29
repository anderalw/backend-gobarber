import TerminalDevice from '../infra/typeorm/entities/TerminalDevice';

export interface ICreateTerminalDeviceDTO {
  provider: string;
  external_id: string;
  name: string;
}

export default interface ITerminalDevicesRepository {
  create(data: ICreateTerminalDeviceDTO): Promise<TerminalDevice>;
  save(device: TerminalDevice): Promise<TerminalDevice>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<TerminalDevice | undefined>;
  // Todas as maquininhas da operadora, por nome
  findByProvider(provider: string): Promise<TerminalDevice[]>;
}
