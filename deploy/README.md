# Subir o Pontual com Docker

Um `docker compose` sobe tudo: site, API, Postgres, MongoDB e Redis. Só uma
porta fica aberta (`WEB_PORT`, padrão 8080), com:

- `/` — o site (barbearia, agendamento, painel);
- `/api` — a API;
- `/files` — as fotos enviadas.

Os bancos ficam só dentro do Docker, com os dados em volumes.

## No seu computador (construindo as imagens)

Com as duas pastas lado a lado (`backend-gobarber` e `front-end-gobarber`):

```bash
cd backend-gobarber/deploy
cp .env.example .env        # troque as senhas e o e-mail do admin
docker compose up -d --build
```

Abra `http://localhost:8080`. Na primeira vez, as migrations rodam sozinhas
e o administrador do `.env` é criado. Entre em `/barbeiro` com o
`ADMIN_EMAIL` e a `ADMIN_PASSWORD` e cadastre o resto pelo painel.

## Num servidor (usando as imagens prontas)

A cada push na `master`, o GitHub Actions testa e publica as imagens
`ghcr.io/anderalw/pontual-api` e `ghcr.io/anderalw/pontual-web`. No
servidor basta esta pasta `deploy`:

```bash
# Só na primeira vez, se as imagens forem privadas (token com read:packages)
docker login ghcr.io -u anderalw

cp .env.example .env
# no .env: APP_URL com o domínio, senhas novas e as imagens publicadas:
#   API_IMAGE=ghcr.io/anderalw/pontual-api:latest
#   WEB_IMAGE=ghcr.io/anderalw/pontual-web:latest
docker compose pull
docker compose up -d --no-build
```

Para atualizar, repita `pull` e `up -d --no-build`: as migrations novas rodam
ao subir.

## Várias barbearias (SaaS)

Uma instalação atende todas as barbearias. Cada uma abre em
`<identificador>.BASE_DOMAIN` ou no domínio próprio, e o próprio Postgres
isola os dados (RLS). Quem abre o `APP_URL` direto cai na `DEFAULT_TENANT`,
que é a instalação de uma barbearia só.

Para o SaaS completo, use o servidor do painel (pasta `infra` do repositório
`gobarber-painel`). Ele junta esta instalação, o Caddy com HTTPS sob demanda
e o painel que cadastra e cobra as barbearias.

## Variáveis importantes

| Variável | Para quê |
| --- | --- |
| `APP_URL` | Endereço público; vai nos links dos e-mails e do WhatsApp |
| `APP_SECRET` | Assina os logins; trocar desconecta todo mundo e exige reconectar a maquininha |
| `DB_PASS` | Senha do Postgres |
| `ADMIN_*` | Primeiro administrador da `DEFAULT_TENANT`, criado só se ela não tiver ninguém |
| `BASE_DOMAIN` | Domínio das barbearias (`<identificador>.BASE_DOMAIN`) |
| `DEFAULT_TENANT` | Barbearia de quem abre o `APP_URL` direto |
| `PLATFORM_TOKEN` | Token do painel do SaaS (rotas `/internal`) |
| `TZ` | Fuso de todas as barbearias da instalação (a agenda segue esse horário) |
| `MAIL_DRIVER` | `ethereal` (testes) ou `ses` |
| `GOOGLE_CLIENT_ID` | Login com Google (vazio = sem o botão) |

## Backup

Os dados ficam nos volumes `postgres-data`, `mongo-data` e `files`. Um
backup simples do Postgres:

```bash
docker compose exec postgres pg_dump -U postgres gostack_gobarber > backup.sql
```
