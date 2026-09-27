import { classToClass } from 'class-transformer';

import Client from './Client';

describe('Client entity', () => {
  it('should not expose the password when serialized', () => {
    const client = new Client();

    Object.assign(client, {
      id: 'client-id',
      name: 'Maria',
      email: 'maria@example.test',
      password: 'hashed-password',
      phone: '999',
    });

    const serialized = JSON.parse(JSON.stringify(classToClass(client)));

    expect(serialized).not.toHaveProperty('password');
    expect(serialized).toMatchObject({ id: 'client-id', name: 'Maria' });
  });
});
