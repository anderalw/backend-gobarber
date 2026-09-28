import dataSource from './dataSource';
import mongoDataSource from './mongoDataSource';

// Abre as duas conexões ao subir o servidor
export default async function connectDatabases(): Promise<void> {
  await Promise.all([dataSource.initialize(), mongoDataSource.initialize()]);
}
