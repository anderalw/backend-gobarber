import dataSource from './dataSource';
import mongoDataSource from './mongoDataSource';
import { installTenancy, checkTenancy } from './tenancy';

// Abre as duas conexões ao subir o servidor, já com o isolamento das
// barbearias ligado
export default async function connectDatabases(): Promise<void> {
  installTenancy();

  await Promise.all([dataSource.initialize(), mongoDataSource.initialize()]);

  await checkTenancy(dataSource);
}
