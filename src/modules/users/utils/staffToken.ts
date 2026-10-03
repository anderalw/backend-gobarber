import { sign } from 'jsonwebtoken';

import authConfig from '@config/auth';
import { tenantClaim } from '@shared/tenancy/TenantContext';
import User from '../infra/typeorm/entities/User';

// Token de login da equipe. Com a senha provisória, leva "pwd": a API só
// deixa ver o perfil e trocar a senha (ver ensureAuthenticated)
export default function staffToken(user: User): string {
  const { secret, expiresIn } = authConfig.jwt;

  return sign(
    {
      role: 'provider',
      ...tenantClaim(),
      ...(user.must_change_password && { pwd: true }),
    },
    secret,
    { subject: user.id, expiresIn },
  );
}
