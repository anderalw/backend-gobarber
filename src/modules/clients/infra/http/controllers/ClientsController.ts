import { Request, Response } from 'express';
import { container } from 'tsyringe';
import CreateClientService from '@modules/clients/services/CreateClientService';
import SearchClientsService from '@modules/clients/services/SearchClientsService';
import CreateClientByProviderService from '@modules/clients/services/CreateClientByProviderService';
import ListClientsService from '@modules/clients/services/ListClientsService';
import ShowClientService from '@modules/clients/services/ShowClientService';
import UpdateClientService from '@modules/clients/services/UpdateClientService';
import UpdateOwnClientService from '@modules/clients/services/UpdateOwnClientService';
import SaveClientExtrasService from '@modules/clients/services/SaveClientExtrasService';
import ProfileFieldsService, {
  ProfileContext,
} from '@modules/catalog/services/ProfileFieldsService';
import Client from '@modules/clients/infra/typeorm/entities/Client';

// Os campos extras (CPF, nascimento, endereço) conferidos pelas regras da
// barbearia antes de gravar qualquer coisa
async function checkedExtras(
  context: ProfileContext,
  body: Request['body'],
  except?: string,
) {
  const values = await container
    .resolve(ProfileFieldsService)
    .check(context, body);

  await container
    .resolve(SaveClientExtrasService)
    .ensureAvailable(values, except);

  return values;
}

function contact(client: Client) {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    cpf: client.cpf ?? null,
    birth_date: client.birth_date ?? null,
    address: client.address ?? null,
    created_at: client.created_at,
    updated_at: client.updated_at,
  };
}

export default class ClientsController {
  // Cadastro rápido pelo barbeiro, na hora de marcar pela agenda
  public async createByProvider(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { name, phone } = request.body;
    const values = await checkedExtras('client_counter', request.body);

    const client = await container
      .resolve(CreateClientByProviderService)
      .execute({ name, phone, email: values.email });

    await container.resolve(SaveClientExtrasService).execute(client, values);

    return response.json({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
    });
  }

  // Barbeiro buscando um cliente para marcar pela agenda
  public async index(request: Request, response: Response): Promise<Response> {
    const searchClients = container.resolve(SearchClientsService);

    const clients = await searchClients.execute(String(request.query.search));

    return response.json(
      clients.map(({ id, name, email, phone }) => ({ id, name, email, phone })),
    );
  }

  // Lista de clientes da barbearia, com o resumo de cada um
  public async directory(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const listClients = container.resolve(ListClientsService);

    return response.json(
      await listClients.execute({
        search: request.query.search ? String(request.query.search) : '',
        page: request.query.page ? Number(request.query.page) : 1,
      }),
    );
  }

  // Ficha do cliente
  public async show(request: Request, response: Response): Promise<Response> {
    const showClient = container.resolve(ShowClientService);

    return response.json(await showClient.execute(request.params.id));
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { name, phone, notes } = request.body;
    const values = await checkedExtras(
      'client_counter',
      request.body,
      request.params.id,
    );

    const client = await container.resolve(UpdateClientService).execute({
      client_id: request.params.id,
      name,
      phone,
      // E-mail escondido: fica o que já estava
      email: 'email' in values ? values.email : undefined,
      notes,
    });

    await container.resolve(SaveClientExtrasService).execute(client, values);

    // Devolve a ficha atualizada
    return response.json(
      await container.resolve(ShowClientService).execute(client.id),
    );
  }

  // O cliente logado atualiza o próprio cadastro
  public async updateMe(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const values = await checkedExtras(
      'client_site',
      request.body,
      request.user.id,
    );

    const client = await container.resolve(UpdateOwnClientService).execute({
      client_id: request.user.id,
      name: request.body.name,
      phone: request.body.phone,
    });

    return response.json(
      contact(
        await container
          .resolve(SaveClientExtrasService)
          .execute(client, values),
      ),
    );
  }

  // Cadastro feito pelo próprio cliente no site
  public async create(request: Request, response: Response): Promise<Response> {
    const { name, email, password, phone } = request.body;
    const values = await checkedExtras('client_site', request.body);

    const client = await container.resolve(CreateClientService).execute({
      name,
      email,
      password,
      phone,
    });

    return response.json(
      contact(
        await container
          .resolve(SaveClientExtrasService)
          .execute(client, values),
      ),
    );
  }
}
