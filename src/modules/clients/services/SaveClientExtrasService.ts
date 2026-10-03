import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import { IProfileValues } from '@modules/catalog/services/ProfileFieldsService';
import Client from '../infra/typeorm/entities/Client';
import IClientsRepository from '../repositories/IClientsRepository';

// Grava os dados extras do cliente (CPF, nascimento, endereço) já
// conferidos pelas regras da barbearia (ProfileFieldsService). Só mexe no
// que veio
@injectable()
class SaveClientExtrasService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,
  ) {}

  // Antes de criar o cliente: o CPF não pode ser de outro
  public async ensureAvailable(
    values: IProfileValues,
    except?: string,
  ): Promise<void> {
    if (!values.cpf) return;

    const owner = await this.clientsRepository.findByCpf(values.cpf);

    if (owner && owner.id !== except) {
      throw new AppError(
        `Este CPF já é do cliente ${owner.name}. Busque por ele na lista.`,
      );
    }
  }

  public async execute(
    client: Client,
    values: IProfileValues,
  ): Promise<Client> {
    const { cpf, birth_date, address } = values;

    if (
      cpf === undefined &&
      birth_date === undefined &&
      address === undefined
    ) {
      return client;
    }

    await this.ensureAvailable(values, client.id);

    if (cpf !== undefined) Object.assign(client, { cpf });
    if (birth_date !== undefined) Object.assign(client, { birth_date });
    if (address !== undefined) Object.assign(client, { address });

    return this.clientsRepository.save(client);
  }
}

export default SaveClientExtrasService;
