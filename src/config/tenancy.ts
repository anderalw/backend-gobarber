// Várias barbearias numa instalação só. Cada uma é encontrada pelo endereço:
// <identificador>.<BASE_DOMAIN> ou o domínio próprio dela
export default {
  // Ex.: pontual.com.br (no computador: localhost)
  baseDomain: (process.env.BASE_DOMAIN || 'localhost').toLowerCase(),

  // Barbearia de quem acessa pelo próprio BASE_DOMAIN, localhost ou o IP:
  // a instalação de uma barbearia só e o ambiente de desenvolvimento
  defaultTenant: (process.env.DEFAULT_TENANT || '').toLowerCase(),
  defaultTenantName: process.env.DEFAULT_TENANT_NAME || '',

  // Endereço do site de cada barbearia; {host} vira o domínio dela.
  // No computador, com o Vite na 3000: http://{host}:3000
  webUrl: process.env.TENANT_WEB_URL || 'https://{host}',
  // Endereço da API (links das fotos). Padrão: o site + /api
  apiUrl: process.env.TENANT_API_URL || '',

  // Papel do Postgres com que a API consulta o banco: sem privilégios de
  // administrador, então as regras de isolamento (RLS) valem para ele.
  // Vazio desliga a troca (não recomendado)
  dbAppRole: process.env.DB_APP_ROLE ?? 'pontual_app',
};
