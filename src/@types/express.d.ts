declare namespace Express {
  // Extensão do Request do Express: o nome precisa ser o mesmo
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export interface Request {
    user: {
      id: string;
      role: 'provider' | 'client';
    };
  }
}
