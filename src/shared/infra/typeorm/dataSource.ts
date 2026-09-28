import 'reflect-metadata';
import 'dotenv/config';
import path from 'path';
import { DataSource } from 'typeorm';

import databaseConfig from '@config/database';

// Banco principal (Postgres). É também o arquivo que a CLI do TypeORM usa
// para rodar e gerar migrations (ver o script "typeorm" do package.json)
const dataSource = new DataSource({
  type: 'postgres',
  ...databaseConfig.postgres,
  entities: [
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'modules',
      '**',
      'infra',
      'typeorm',
      'entities',
      '*.{ts,js}',
    ),
  ],
  migrations: [path.resolve(__dirname, 'migrations', '*.{ts,js}')],
});

export default dataSource;
