import { Response, Request } from 'express';
import { container } from 'tsyringe';
import { instanceToInstance } from 'class-transformer';

import AuthencicateUserService from '@modules/users/services/AuthenticateUserService';

export default class SessionsController {
  public async create(request: Request, response: Response): Promise<Response> {
    const { email, password } = request.body;

    const authenticateUser = container.resolve(AuthencicateUserService);

    const { user, token } = await authenticateUser.execute({
      email,
      password,
    });

    return response.json({ user: instanceToInstance(user), token });
  }
}
