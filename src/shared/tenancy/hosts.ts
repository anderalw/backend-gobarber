import tenancyConfig from '@config/tenancy';
import { currentTenant, ITenant } from './TenantContext';

// Identificadores que viram subdomínio e não podem ser de uma barbearia
export const RESERVED_SLUGS = [
  'www',
  'api',
  'app',
  'painel',
  'admin',
  'mail',
  'smtp',
  'static',
  'files',
  'status',
  'suporte',
];

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export const DOMAIN_PATTERN =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

// "Barbearia.COM.br:443" -> "barbearia.com.br"
export function normalizeHost(host: string | undefined): string {
  const value = (host || '').trim().toLowerCase();

  if (value.startsWith('[')) return value.slice(0, value.indexOf(']') + 1);

  return value.split(':')[0].replace(/\.$/, '');
}

export type HostMatch =
  | { kind: 'default' }
  | { kind: 'slug'; slug: string }
  | { kind: 'domain'; domains: string[] }
  | { kind: 'none' };

// Como procurar a barbearia de um endereço
export function matchHost(
  rawHost: string | undefined,
  baseDomain = tenancyConfig.baseDomain,
): HostMatch {
  const host = normalizeHost(rawHost);

  if (!host) return { kind: 'none' };

  if (host === baseDomain || LOCAL_HOSTS.includes(host)) {
    return { kind: 'default' };
  }

  const suffix = `.${baseDomain}`;

  if (host.endsWith(suffix)) {
    const slug = host.slice(0, -suffix.length);

    // Só um nível: ze.pontual.com.br (www.ze... não é uma barbearia)
    return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.includes(slug)
      ? { kind: 'slug', slug }
      : { kind: 'none' };
  }

  // Domínio próprio, com ou sem o "www."
  const bare = host.startsWith('www.') ? host.slice(4) : host;

  return { kind: 'domain', domains: [bare, `www.${bare}`] };
}

// Endereço principal da barbearia: o domínio próprio ou o subdomínio
export function tenantHost(
  tenant: Pick<ITenant, 'slug' | 'custom_domain'>,
): string {
  return tenant.custom_domain || `${tenant.slug}.${tenancyConfig.baseDomain}`;
}

function strip(url: string): string {
  return url.replace(/\/+$/, '');
}

// Site da barbearia atual (links de e-mail, WhatsApp...). Fora de uma
// barbearia (testes, scripts) vale o APP_WEB_URL de antes
export function webUrl(): string {
  const tenant = currentTenant();

  if (!tenant) return strip(process.env.APP_WEB_URL || '');

  return strip(tenancyConfig.webUrl.replace('{host}', tenantHost(tenant)));
}

// API da barbearia atual (links das fotos)
export function apiUrl(): string {
  const tenant = currentTenant();

  if (!tenant) return strip(process.env.APP_API_URL || '');

  if (!tenancyConfig.apiUrl) return `${webUrl()}/api`;

  return strip(tenancyConfig.apiUrl.replace('{host}', tenantHost(tenant)));
}
