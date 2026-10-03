import { Request, Response } from 'express';
import { sign } from 'jsonwebtoken';

import authConfig from '@config/auth';
import AppError from '@shared/errors/AppError';
import {
  runWithTenant,
  tenantClaim,
  ITenant,
} from '@shared/tenancy/TenantContext';
import ensureAuthenticated from './ensureAuthenticated';

const ze: ITenant = {
  id: 'tenant-ze',
  slug: 'ze',
  name: 'Zé',
  custom_domain: null,
  status: 'active',
};
const cia: ITenant = { ...ze, id: 'tenant-cia', slug: 'cia' };

function tokenFor(payload: object): string {
  return sign(payload, authConfig.jwt.secret, { subject: 'user-1' });
}

function authenticate(token: string): Request {
  const request = {
    headers: { authorization: `Bearer ${token}` },
  } as unknown as Request;

  ensureAuthenticated(request, {} as Response, jest.fn());

  return request;
}

describe('Login preso à barbearia', () => {
  it('should accept a token of the same barbershop', () => {
    const token = runWithTenant(ze, () =>
      tokenFor({ role: 'provider', ...tenantClaim() }),
    );

    const request = runWithTenant(ze, () => authenticate(token));

    expect(request.user).toEqual({ id: 'user-1', role: 'provider' });
  });

  it('should reject a token of another barbershop', () => {
    const token = runWithTenant(ze, () =>
      tokenFor({ role: 'client', ...tenantClaim() }),
    );

    expect(() => runWithTenant(cia, () => authenticate(token))).toThrow(
      AppError,
    );
  });

  it('should reject tokens issued before the barbershops existed', () => {
    const token = tokenFor({ role: 'provider' });

    expect(() => runWithTenant(ze, () => authenticate(token))).toThrow(
      AppError,
    );
  });
});
