# API do Pontual. Roda com ts-node (igual ao "yarn start"), aplica as
# migrations ao subir e cria o primeiro administrador se o banco estiver
# vazio (ADMIN_* no ambiente)
FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000 && yarn cache clean

COPY tsconfig.json ./
COPY src ./src
COPY docker-entrypoint.sh ./

# Fotos enviadas (com STORAGE_DRIVE=disk); no compose vira um volume
RUN mkdir -p tmp/uploads

# Os horários da agenda seguem o fuso do servidor: o da barbearia (o
# compose pode trocar com TZ)
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    DB_LOGGING=false \
    PORT=3333

EXPOSE 3333

CMD ["sh", "docker-entrypoint.sh"]
