declare namespace Express {
  // Extensão do Request do Express: o nome precisa ser o mesmo
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export interface Request {
    user: {
      id: string;
      role: 'provider' | 'client';
    };
    // Usuário da equipe com o perfil, quando já carregado (ensurePermission)
    staff?: import('@modules/users/infra/typeorm/entities/User').default;
  }
}
