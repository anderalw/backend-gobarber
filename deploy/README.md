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

## Um ambiente por barbearia (SaaS)

Cada barbearia é uma cópia desta pasta com o próprio `.env`, que define:

- `APP_URL`;
- `WEB_PORT`;
- as senhas;
- o admin;
- o fuso `TZ`.

A cópia também precisa de outro nome de projeto (`docker compose -p barbearia-x`). Os volumes
ficam separados por projeto, então os dados de uma não se misturam com os
da outra. Na frente, um proxy (Caddy, Traefik ou nginx) liga cada domínio à
porta do cliente e cuida do HTTPS.

## Variáveis importantes

| Variável | Para quê |
| --- | --- |
| `APP_URL` | Endereço público; vai nos links dos e-mails e do WhatsApp |
| `APP_SECRET` | Assina os logins; trocar desconecta todo mundo e exige reconectar a maquininha |
| `DB_PASS` | Senha do Postgres |
| `ADMIN_*` | Primeiro administrador, criado só com o banco vazio |
| `TZ` | Fuso da barbearia (a agenda segue esse horário) |
| `MAIL_DRIVER` | `ethereal` (testes) ou `ses` |
| `GOOGLE_CLIENT_ID` | Login com Google (vazio = sem o botão) |

## Backup

Os dados ficam nos volumes `postgres-data`, `mongo-data` e `files`. Um
backup simples do Postgres:

```bash
docker compose exec postgres pg_dump -U postgres gostack_gobarber > backup.sql
```
