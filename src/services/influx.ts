import { InfluxDB, FluxTableMetaData, FluxResultObserver } from '@influxdata/influxdb-client';
import { loadConfig } from '../config/index.js';

const config = loadConfig();

export type QueryOptions = {
  flux: string;
  params?: Record<string, string>;
};

let influxClient: InfluxDB | null = null;
let queryApi: ReturnType<InfluxDB['getQueryApi']> | null = null;

/**
 * Inizializza il client InfluxDB se non già creato
 */
function getInfluxClient(): InfluxDB {
  if (!influxClient) {
    const { url, token, org } = config.influxDefault;
    
    if (!url || !token || !org) {
      throw new Error(
        'InfluxDB configuration missing. Please set INFLUX_URL, INFLUX_TOKEN, and INFLUX_ORG in .env.local'
      );
    }

    console.log(`🔌 Connecting to InfluxDB at ${url} (org: ${org})`);
    influxClient = new InfluxDB({ url, token });
  }
  
  return influxClient;
}

/**
 * Ottiene l'API per eseguire query Flux
 */
function getQueryApi() {
  if (!queryApi) {
    const client = getInfluxClient();
    const { org } = config.influxDefault;
    
    if (!org) {
      throw new Error('INFLUX_ORG is required');
    }
    
    queryApi = client.getQueryApi(org);
  }
  
  return queryApi;
}

/**
 * Esegue una query Flux su InfluxDB e ritorna i risultati
 */
export async function executeFluxQuery(options: QueryOptions): Promise<unknown[]> {
  const { flux: fluxQuery, params } = options;
  
  if (!fluxQuery || fluxQuery.trim().length === 0) {
    throw new Error('Flux query is required');
  }

  // Sostituisci parametri nella query se forniti
  let finalQuery = fluxQuery;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      finalQuery = finalQuery.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
  }

  const api = getQueryApi();
  const results: unknown[] = [];

  return new Promise((resolve, reject) => {
    const observer: FluxResultObserver<unknown> = {
      next(row: string[], tableMeta: FluxTableMetaData): void {
        // Converti ogni riga in un oggetto con nomi di colonna
        const record: Record<string, unknown> = {};
        tableMeta.columns.forEach((col, index) => {
          const value = row[index];
          // Converti tipi comuni
          if (value === 'true' || value === 'false') {
            record[col.label] = value === 'true';
          } else if (value !== null && !isNaN(Number(value)) && value !== '') {
            record[col.label] = Number(value);
          } else {
            record[col.label] = value;
          }
        });
        results.push(record);
      },
      error(error: Error): void {
        console.error('❌ InfluxDB query error:', error);
        reject(error);
      },
      complete(): void {
        console.log(`✅ Query completed: ${results.length} rows returned`);
        resolve(results);
      },
    };

    try {
      api.queryRows(finalQuery, observer);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Esegue una query Flux semplice con range temporale e filtri di base
 * Supporta sia range relativi (es: -7d) che assoluti (es: 2024-11-07T00:00:00Z)
 */
export async function queryEnergyData(options: {
  start: string;
  end: string;
  measurement?: string;
  filters?: Record<string, string>;
  bucket?: string;
}): Promise<unknown[]> {
  const { start, end, measurement = 'energy', filters = {}, bucket } = options;
  const targetBucket = bucket || config.influxDefault.bucket || 'energy-data';

  if (!targetBucket) {
    throw new Error('Bucket is required. Set INFLUX_BUCKET in .env.local or pass bucket parameter');
  }

  // Normalizza start e end per Flux:
  // - Range relativi (es: -7d, -1h): usali direttamente
  // - "now": converti in now()
  // - Date assolute ISO: usale direttamente come stringa (Flux le converte automaticamente)
  const startParam = start.startsWith('-') || start.match(/^\d{4}-\d{2}-\d{2}/) ? start : start === 'now' ? 'now()' : start;
  const endParam = end === 'now' || end === '' ? 'now()' : end.startsWith('-') || end.match(/^\d{4}-\d{2}-\d{2}/) ? end : end;

  // Costruisci query Flux base
  // Per Flux: range relativi vanno tra virgolette se non sono letterali
  const startFlux = startParam === 'now()' ? 'now()' : startParam.startsWith('-') ? startParam : `"${startParam}"`;
  const endFlux = endParam === 'now()' ? 'now()' : endParam.startsWith('-') ? endParam : `"${endParam}"`;
  
  let fluxQuery = `from(bucket: "${targetBucket}")
  |> range(start: ${startFlux}, stop: ${endFlux})
  |> filter(fn: (r) => r._measurement == "${measurement}")`;

  // Aggiungi filtri opzionali
  if (Object.keys(filters).length > 0) {
    for (const [key, value] of Object.entries(filters)) {
      fluxQuery += `\n  |> filter(fn: (r) => r.${key} == "${value}")`;
    }
  }

  console.log(`📊 Executing Flux query:\n${fluxQuery}`);
  return executeFluxQuery({ flux: fluxQuery });
}

/**
 * Testa la connessione a InfluxDB
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { url, token, org, bucket } = config.influxDefault;
    
    if (!url || !token || !org) {
      throw new Error('InfluxDB configuration missing');
    }

    // Query semplice per testare la connessione usando il bucket configurato
    const targetBucket = bucket || 'energy-data';
    const api = getQueryApi();
    const testQuery = `from(bucket: "${targetBucket}") |> range(start: -1h) |> limit(n: 1)`;
    
    return new Promise((resolve) => {
      let hasData = false;
      let resolved = false;
      const observer: FluxResultObserver<unknown> = {
        next(): void {
          hasData = true;
        },
        error(error: Error): void {
          console.error('InfluxDB connection test error:', error);
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        },
        complete(): void {
          if (!resolved) {
            resolved = true;
            // La connessione funziona anche se non ci sono dati (bucket vuoto)
            resolve(true);
          }
        },
      };

      try {
        api.queryRows(testQuery, observer);
        // Timeout dopo 5 secondi se non risponde
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }, 5000);
      } catch (error) {
        console.error('Connection test exception:', error);
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}
