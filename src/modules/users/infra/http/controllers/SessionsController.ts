import { Response, Request } from 'express';
import { container } from 'tsyringe';

import AuthencicateUserService from '@modules/users/services/AuthenticateUserService';

export default class SessionsController {
  public async create(request: Request, response: Response): Promise<Response> {
    const { email, password } = request.body;

    const authenticateUser = container.resolve(AuthencicateUserService);

    const { user, token } = await authenticateUser.execute({
      email,
      password,
    });
    delete user.password;

    return response.json({ user, token });
  }
}
