import { Response, Request } from 'express';
import { container } from 'tsyringe';
import { instanceToInstance } from 'class-transformer';

import UpdateProfileService from '@modules/users/services/UpdateProfileService';
import ShowProfileService from '@modules/users/services/ShowProfileService';
import ChangeFirstPasswordService from '@modules/users/services/ChangeFirstPasswordService';

export default class ProfileControler {
  public async show(request: Request, response: Response): Promise<Response> {
    const user_id = request.user.id;

    const showProfile = container.resolve(ShowProfileService);

    const user = await showProfile.execute({ user_id });

    return response.json(instanceToInstance(user));
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const user_id = request.user.id;
    const { name, email, old_password, password } = request.body;

    const updateProfile = container.resolve(UpdateProfileService);

    const user = await updateProfile.execute({
      user_id,
      name,
      email,
      old_password,
      password,
    });

    return response.json(instanceToInstance(user));
  }

  // Troca da senha provisória (primeiro acesso): devolve um token novo
  public async changePassword(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { user, token } = await container
      .resolve(ChangeFirstPasswordService)
      .execute(request.user.id, request.body.password);

    return response.json({ user: instanceToInstance(user), token });
  }
}
