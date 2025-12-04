# Architettura Connector ↔ InfluxDB

## Situazione Attuale

```
┌─────────────────────────────────────────────────────────────┐
│                     ARCHITETTURA ATTUALE                     │
└─────────────────────────────────────────────────────────────┘

Browser/Frontend  ──HTTP──►  Connector (localhost:3001)
                                      │
                                      │ ✅ CONNESSO (FUNZIONANTE)
                                      │
                           InfluxDB (localhost:8086)
                                  (Docker)
```

**Stato**: Il connector è completamente implementato e funzionante - si connette realmente a InfluxDB usando `@influxdata/influxdb-client`.

---

## Come DOVREBBE Funzionare

```
┌─────────────────────────────────────────────────────────────┐
│                  ARCHITETTURA CORRETTA                       │
└─────────────────────────────────────────────────────────────┘

1. Browser/Frontend fa richiesta HTTP
   GET http://localhost:3001/bulk/export

2. Connector riceve la richiesta
   - Valida autenticazione (token/PIN)
   - Estrae parametri (start, end, query)

3. Connector si connette a InfluxDB
   - URL: http://localhost:8086 (dal .env.local)
   - Org: energy-org
   - Bucket: energy-data
   - Token: energy-connector-token-dev-local-only
   - Usa libreria @influxdata/influxdb-client

4. Connector esegue query Flux su InfluxDB
   - Query esempio:
     ```
     from(bucket: "energy-data")
       |> range(start: -7d)
       |> filter(fn: (r) => r._measurement == "energy")
     ```

5. InfluxDB ritorna i dati
   - Serie temporali in formato InfluxDB

6. Connector processa i dati
   - Converte in JSONL (JSON Lines)
   - Comprima con zstd
   - Calcola SHA-256 hash

7. Connector ritorna risposta
   - Job ID per tracking
   - Status endpoint per monitoraggio
   - Download endpoint per scaricare i dati
```

---

## Flusso Dettagliato

### 1. Configurazione (da `.env.local`)

```env
INFLUX_URL=http://localhost:8086      ← Docker espone su questa porta
INFLUX_ORG=energy-org                 ← Organizzazione InfluxDB
INFLUX_BUCKET=energy-data             ← Bucket con i dati
INFLUX_TOKEN=energy-connector-token... ← Token di autenticazione
```

### 2. Connessione InfluxDB

Il connector usa la libreria ufficiale `@influxdata/influxdb-client`:

```typescript
import { InfluxDB, flux } from '@influxdata/influxdb-client';

const influxDB = new InfluxDB({
  url: config.influxDefault.url,        // http://localhost:8086
  token: config.influxDefault.token,    // Token dal .env.local
});

const queryApi = influxDB.getQueryApi(config.influxDefault.org);
```

### 3. Esecuzione Query Flux

```typescript
const fluxQuery = `
  from(bucket: "${config.influxDefault.bucket}")
    |> range(start: ${start}, stop: ${end})
    |> filter(fn: (r) => r._measurement == "energy")
`;

const results = [];
for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
  const row = {};
  tableMeta.columns.forEach((col, index) => {
    row[col.label] = values[index];
  });
  results.push(row);
}
```

### 4. Docker Network

```
┌─────────────────────────────────────────┐
│  Docker Network (bridge)                │
│                                         │
│  ┌─────────────────┐                   │
│  │  InfluxDB       │                   │
│  │  Port: 8086     │                   │
│  │  Container:     │                   │
│  │  energy-influxdb│                   │
│  └─────────────────┘                   │
│         │                               │
│         │ localhost:8086                │
│         │ (esposto sulla macchina)      │
│         │                               │
└─────────┼───────────────────────────────┘
          │
          │ HTTP
          │
┌─────────▼───────────────────────────────┐
│  Connector (Node.js)                    │
│  Port: 3001                             │
│  Fuori da Docker                        │
│  Si connette a localhost:8086           │
└─────────────────────────────────────────┘
```

**Nota importante**: 
- InfluxDB è **dentro** Docker (container `energy-influxdb`)
- Il connector è **fuori** Docker (processo Node.js normale)
- Il connector si connette a `localhost:8086` perché Docker **espone** la porta 8086 sulla macchina host

---

## Stato Implementazione

1. ✅ **Configurazione**: Fatto (`.env.local` con credenziali)

2. ✅ **Libreria InfluxDB**: Installata `@influxdata/influxdb-client`

3. ✅ **Implementazione connessione**: Il file `src/services/influx.ts` è completamente implementato
   - ✅ Crea client InfluxDB
   - ✅ Esegue query Flux
   - ✅ Ritorna dati formattati

4. ✅ **Integrazione con bulk export**: `src/routes/bulk.ts` esegue query reali e processa dati

5. ⚠️ **Gestione file export**: 
   - ✅ Hashing SHA-256 implementato
   - ⚠️ Compressione zstd non ancora implementata
   - ⚠️ Salvataggio su disco non ancora implementato (dati in memoria)

---

## Funzionalità Implementate

1. ✅ Connessione reale a InfluxDB
2. ✅ Query Flux funzionanti
3. ✅ Export dati con hash SHA-256
4. ✅ Download dati in formato JSONL
5. ✅ Autenticazione con PIN e token
6. ✅ Health check endpoint

