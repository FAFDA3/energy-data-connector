import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

let cachedConfig: Config | null = null;

const envSchema = z.object({
  INFLUX_URL: z.string().url().optional(),
  INFLUX_ORG: z.string().optional(),
  INFLUX_BUCKET: z.string().optional(),
  INFLUX_TOKEN: z.string().optional(),
  POLYGON_RPC_URL: z.string().url().optional(),
  ANCHOR_PRIVATE_KEY: z.string().optional(),
  ANCHOR_CONTRACT_ADDRESS: z.string().optional(),
  CONNECTOR_PORT: z.string().default('3001'),
  SESSION_PIN: z.string().optional(),
  SESSION_TTL_SECONDS: z.string().default('900'),
  LOG_LEVEL: z.string().default('info'),
  CONNECTOR_ALLOWED_ORIGINS: z.string().optional(),
});

export type Config = {
  influxDefault: {
    url?: string;
    org?: string;
    bucket?: string;
    token?: string;
  };
  blockchain: {
    rpcUrl?: string;
    privateKey?: string;
    contractAddress?: string;
  };
  connector: {
    port: number;
    sessionPin?: string;
    sessionTtlSeconds: number;
    logLevel: string;
    allowedOrigins: string[];
  };
};

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  loadEnv();
  const env = envSchema.parse(process.env);

  cachedConfig = {
    influxDefault: {
      url: env.INFLUX_URL,
      org: env.INFLUX_ORG,
      bucket: env.INFLUX_BUCKET,
      token: env.INFLUX_TOKEN,
    },
    blockchain: {
      rpcUrl: env.POLYGON_RPC_URL,
      privateKey: env.ANCHOR_PRIVATE_KEY,
      contractAddress: env.ANCHOR_CONTRACT_ADDRESS,
    },
    connector: {
      port: Number(env.CONNECTOR_PORT),
      sessionPin: env.SESSION_PIN,
      sessionTtlSeconds: Number(env.SESSION_TTL_SECONDS),
      logLevel: env.LOG_LEVEL,
      allowedOrigins: env.CONNECTOR_ALLOWED_ORIGINS
        ? env.CONNECTOR_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
        : ['http://localhost:5173'],
    },
  };

  return cachedConfig;
}
