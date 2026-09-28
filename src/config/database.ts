// Conexões com os bancos. Os padrões são os dos contêineres Docker de
// desenvolvimento (os mesmos do antigo ormconfig.example.json); em outro
// ambiente, defina as variáveis no .env
export default {
  postgres: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'docker',
    database: process.env.DB_NAME || 'gostack_gobarber',
    // Mostra as queries no terminal; DB_LOGGING=false desliga
    logging: process.env.DB_LOGGING !== 'false',
  },

  mongo: {
    url: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/gostack_gobarber',
  },
};
