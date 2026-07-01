export interface EnvConfig {
  kommo: {
    baseUrl: string;
    accessToken: string;
    driveUrl: string;
  };
  db: {
    baseUrl: string;
    accessToken: string;
  };
  app: {
    port: number;
    nodeEnv: 'development' | 'production' | 'test';
  };
}

export function loadEnvConfig(): EnvConfig {
  const requiredVars = ['KOMMO_ACCESS_TOKEN', 'DB_CONNECTION', 'DB_KEY'];

  const missingVars = requiredVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    throw new Error(
      `Variáveis de ambiente faltando: ${missingVars.join(', ')}`,
    );
  }

  return {
    kommo: {
      baseUrl: process.env.KOMMO_BASE_URL ?? 'https://genterrh.kommo.com',
      accessToken: process.env.KOMMO_ACCESS_TOKEN,
      driveUrl: process.env.KOMMO_DRIVE_URL ?? 'https://drive-c.kommo.com',
    },
    app: {
      port: parseInt(process.env.PORT ?? '3000', 10),
      nodeEnv: (process.env.NODE_ENV ?? 'development') as
        | 'development'
        | 'production'
        | 'test',
    },
    db: {
      baseUrl: process.env.DB_CONNECTION,
      accessToken: process.env.DB_KEY,
    },
  };
}
