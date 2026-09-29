import { Request, Response } from 'express';
import { container } from 'tsyringe';
import CreateClientService from '@modules/clients/services/CreateClientService';
import SearchClientsService from '@modules/clients/services/SearchClientsService';
import CreateClientByProviderService from '@modules/clients/services/CreateClientByProviderService';
import ListClientsService from '@modules/clients/services/ListClientsService';
import ShowClientService from '@modules/clients/services/ShowClientService';
import UpdateClientService from '@modules/clients/services/UpdateClientService';
import UpdateOwnClientService from '@modules/clients/services/UpdateOwnClientService';

export default class ClientsController {
  // Cadastro rápido pelo barbeiro, na hora de marcar pela agenda
  public async createByProvider(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { name, phone, email } = request.body;

    const createClient = container.resolve(CreateClientByProviderService);

    const client = await createClient.execute({ name, phone, email });

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
    const { name, phone, email, notes } = request.body;

    const updateClient = container.resolve(UpdateClientService);
    const showClient = container.resolve(ShowClientService);

    const client = await updateClient.execute({
      client_id: request.params.id,
      name,
      phone,
      email,
      notes,
    });

    // Devolve a ficha atualizada
    return response.json(await showClient.execute(client.id));
  }

  // O cliente logado atualiza o próprio nome e telefone
  public async updateMe(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const client = await container.resolve(UpdateOwnClientService).execute({
      client_id: request.user.id,
      name: request.body.name,
      phone: request.body.phone,
    });

    return response.json({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      created_at: client.created_at,
      updated_at: client.updated_at,
    });
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const { name, email, password, phone } = request.body;

    const createClient = container.resolve(CreateClientService);

    const client = await createClient.execute({
      name,
      email,
      password,
      phone,
    });

    // Removemos a password do retorno por segurança
    const clientWithoutPassword = {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      created_at: client.created_at,
      updated_at: client.updated_at,
    };

    return response.json(clientWithoutPassword);
  }
}
