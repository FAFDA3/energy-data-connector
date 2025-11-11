import { loadConfig } from '../config/index.js';

const config = loadConfig();

export type QueryOptions = {
  flux: string;
  params?: Record<string, string>;
};

export async function executeFluxQuery(_options: QueryOptions): Promise<unknown[]> {
  // TODO: implement InfluxDB client logic using official client.
  console.log('executeFluxQuery called with default config', config.influxDefault);
  return [];
}
