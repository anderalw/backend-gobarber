import { matchHost, normalizeHost, tenantHost, webUrl, apiUrl } from './hosts';
import { runWithTenant, ITenant } from './TenantContext';

const tenant: ITenant = {
  id: 't1',
  slug: 'ze',
  name: 'Barbearia do Zé',
  custom_domain: null,
  status: 'active',
};

describe('Endereço de cada barbearia', () => {
  it('should normalize hosts', () => {
    expect(normalizeHost('Ze.Pontual.COM.br:443')).toBe('ze.pontual.com.br');
    expect(normalizeHost('pontual.com.br.')).toBe('pontual.com.br');
    expect(normalizeHost(undefined)).toBe('');
  });

  it('should find the barbershop by subdomain', () => {
    expect(matchHost('ze.pontual.com.br', 'pontual.com.br')).toEqual({
      kind: 'slug',
      slug: 'ze',
    });
  });

  it('should send the base domain and localhost to the default barbershop', () => {
    expect(matchHost('pontual.com.br', 'pontual.com.br').kind).toBe('default');
    expect(matchHost('localhost:3000', 'pontual.com.br').kind).toBe('default');
    expect(matchHost('127.0.0.1', 'pontual.com.br').kind).toBe('default');
  });

  it('should not accept reserved or nested subdomains', () => {
    expect(matchHost('painel.pontual.com.br', 'pontual.com.br').kind).toBe(
      'none',
    );
    expect(matchHost('www.ze.pontual.com.br', 'pontual.com.br').kind).toBe(
      'none',
    );
    expect(matchHost('', 'pontual.com.br').kind).toBe('none');
  });

  it('should look up custom domains with and without www', () => {
    expect(matchHost('www.barbeariadoze.com.br', 'pontual.com.br')).toEqual({
      kind: 'domain',
      domains: ['barbeariadoze.com.br', 'www.barbeariadoze.com.br'],
    });
  });

  it('should prefer the custom domain as the main address', () => {
    expect(tenantHost(tenant)).toBe('ze.localhost');
    expect(
      tenantHost({ ...tenant, custom_domain: 'barbeariadoze.com.br' }),
    ).toBe('barbeariadoze.com.br');
  });

  it('should build links for the current barbershop', () => {
    process.env.APP_WEB_URL = 'http://antigo:3000/';

    // Fora de uma barbearia vale o endereço de antes
    expect(webUrl()).toBe('http://antigo:3000');

    runWithTenant(tenant, () => {
      expect(webUrl()).toBe('https://ze.localhost');
      expect(apiUrl()).toBe('https://ze.localhost/api');
    });
  });
});
