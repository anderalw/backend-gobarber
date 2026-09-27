import { Request, Response } from 'express';
import { sign } from 'jsonwebtoken';

import authConfig from '@config/auth';
import AppError from '@shared/errors/AppError';
import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from './ensureRole';

const response = {} as Response;

function requestWithToken(payload: object): Request {
  const token = sign(payload, authConfig.jwt.secret, { subject: 'some-id' });

  return { headers: { authorization: `Bearer ${token}` } } as Request;
}

describe('ensureAuthenticated', () => {
  it('should fill request.user with the id and role from the token', () => {
    const request = requestWithToken({ role: 'client' });
    const next = jest.fn();

    ensureAuthenticated(request, response, next);

    expect(next).toHaveBeenCalled();
    expect(request.user).toEqual({ id: 'some-id', role: 'client' });
  });

  it('should reject tokens without a role', () => {
    const request = requestWithToken({});

    expect(() => ensureAuthenticated(request, response, jest.fn())).toThrow(
      AppError,
    );
  });

  it('should reject tokens with an unknown role', () => {
    const request = requestWithToken({ role: 'admin' });

    expect(() => ensureAuthenticated(request, response, jest.fn())).toThrow(
      AppError,
    );
  });
});

describe('ensureRole', () => {
  it('should allow a request with an accepted role', () => {
    const request = { user: { id: 'id', role: 'provider' } } as Request;
    const next = jest.fn();

    ensureRole('provider')(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should block a client on a provider-only route', () => {
    const request = { user: { id: 'id', role: 'client' } } as Request;
    const next = jest.fn();

    expect(() => ensureRole('provider')(request, response, next)).toThrow(
      AppError,
    );
    expect(next).not.toHaveBeenCalled();
  });
});
