import { Request, Response } from 'express';

import AppError from '@shared/errors/AppError';
import ensureMetricsToken from './ensureMetricsToken';

const call = (authorization?: string): (() => void) => {
  const request = { headers: { authorization } } as unknown as Request;

  return () => ensureMetricsToken(request, {} as Response, jest.fn());
};

describe('Token das rotas internas', () => {
  afterEach(() => {
    delete process.env.METRICS_TOKEN;
  });

  it('should not exist without METRICS_TOKEN', () => {
    expect(call('Bearer qualquer')).toThrow(
      expect.objectContaining({ statusCode: 404 }),
    );
  });

  it('should only accept the configured token', () => {
    process.env.METRICS_TOKEN = 'token-do-painel-123';

    expect(call()).toThrow(AppError);
    expect(call('Bearer outro-token-qualquer')).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    );
    expect(call('Basic token-do-painel-123')).toThrow(AppError);
    expect(call('Bearer token-do-painel-123')).not.toThrow();
  });
});
