import path from 'path';
import { DataSource } from 'typeorm';

import databaseConfig from '@config/database';

// Notificações ficam no MongoDB
const mongoDataSource = new DataSource({
  type: 'mongodb',
  url: databaseConfig.mongo.url,
  entities: [
    path.resolve(__dirname, '..', '..', '..', 'modules', '**', 'infra', 'typeorm', 'schemas', '*.{ts,js}'),
  ],
});

export default mongoDataSource;
