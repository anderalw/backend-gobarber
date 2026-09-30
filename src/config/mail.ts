interface IMailConfig {
  driver: 'ethereal' | 'ses';

  defaults: {
    from: {
      email: string;
      name: string;
    };
  };
}

export default {
  driver: process.env.MAIL_DRIVER || 'ethereal',

  defaults: {
    from: {
      // Remetente dos e-mails (defina MAIL_FROM com um domínio seu)
      email: process.env.MAIL_FROM || 'equipe@pontual.com.br',
      name: 'Equipe Pontual',
    },
  },
} as IMailConfig;
