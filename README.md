# Energy Connector

On-premise service that exports data from InfluxDB, produces canonical datasets and hashes, and anchors evidence on Polygon. The connector is designed to run inside the plant network alongside InfluxDB.

## Features (roadmap)

- Session-based authentication (PIN + short-lived bearer token)
- Configurable Influx DB connections and query templates
- Bulk export jobs with progress reporting and downloadable artifacts
- SHA-256 hashing and manifest generation
- Optional on-chain anchoring through configured RPC provider
- REST + Server-Sent Events APIs tailored for the Energy Data Anchoring frontend

## Project structure

```
connector/
 ├─ src/
 │   ├─ config/          # env parsing
 │   ├─ middleware/      # auth layer
 │   ├─ routes/          # Express routes (health, session, bulk, anchor)
 │   └─ services/        # Job manager, hashing, influx client (stubs)
 ├─ scripts/
 │   ├─ setup-influxdb.ps1  # Setup script per InfluxDB locale (Windows)
 │   └─ seed-demo-data.ps1  # Script per popolare dati demo
 ├─ config/
 │   ├─ connections.example.json
 │   └─ queries.example.json
 ├─ docker-compose.yml   # Docker Compose per InfluxDB locale
 ├─ .env.example
 └─ package.json
```

## Getting started

### Local Development with Docker

Per testare il connector localmente, è necessario configurare un'istanza InfluxDB locale.

#### Prerequisiti

- Docker Desktop installato e in esecuzione
- PowerShell (per Windows) o Bash (per Linux/Mac)

#### Setup InfluxDB locale

1. **Avvia InfluxDB con Docker Compose:**

   ```bash
   docker-compose up -d
   ```

   Questo avvierà InfluxDB 2.x su `http://localhost:8086` con le seguenti configurazioni predefinite:
   - **Username**: `admin`
   - **Password**: `admin123456`
   - **Org**: `energy-org`
   - **Bucket**: `energy-data`
   - **Token**: `energy-connector-token-dev-local-only`

2. **Configura il connector:**

   Su Windows (PowerShell):
   ```powershell
   .\scripts\setup-influxdb.ps1
   ```

   Questo script:
   - Verifica che Docker Desktop sia in esecuzione
   - Verifica che il container InfluxDB sia attivo
   - Attende che InfluxDB sia pronto
   - Crea il file `.env.local` con le configurazioni corrette

3. **Popola InfluxDB con dati demo:**

   Su Windows (PowerShell):
   ```powershell
   .\scripts\seed-demo-data.ps1
   ```

   Questo script inserisce dati demo di energia per gli ultimi 7 giorni:
   - 3 sensori di consumo (building-a, building-b, building-c)
   - 2 pannelli solari (solar-panel-1, solar-panel-2)
   - 1 turbina eolica (wind-turbine-1)
   - Dati ogni 15 minuti con valori realistici

4. **Avvia il connector:**

   ```bash
   npm install
   npm run dev
   ```

   Il connector sarà disponibile su `http://localhost:3001` (o la porta configurata in `.env.local`).

5. **Accedi all'interfaccia web InfluxDB:**

   Apri `http://localhost:8086` nel browser per visualizzare e gestire i dati.

#### Configurazione `.env.local`

Lo script `setup-influxdb.ps1` crea automaticamente il file `.env.local` con le seguenti configurazioni:

```env
# InfluxDB Local Configuration
INFLUX_URL=http://localhost:8086
INFLUX_ORG=energy-org
INFLUX_BUCKET=energy-data
INFLUX_TOKEN=energy-connector-token-dev-local-only

# Connector Configuration
CONNECTOR_PORT=3001
SESSION_TTL_SECONDS=900
LOG_LEVEL=info
CONNECTOR_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

Puoi modificare questo file per personalizzare la configurazione locale.

#### Esempi di query Flux

Una volta popolati i dati demo, puoi testare query Flux come:

```flux
// Query base: tutti i dati di energia
from(bucket: "energy-data")
  |> range(start: -7d)
  |> filter(fn: (r) => r._measurement == "energy")

// Consumo totale per building
from(bucket: "energy-data")
  |> range(start: -24h)
  |> filter(fn: (r) => r.type == "consumption")
  |> group(columns: ["location"])
  |> sum()

// Produzione solare nell'ultima settimana
from(bucket: "energy-data")
  |> range(start: -7d)
  |> filter(fn: (r) => r.type == "production" and r.location =~ /solar-/)
  |> aggregateWindow(every: 1h, fn: mean)
```

### Production Setup

Copy `.env.example` to `.env` and adjust according to the plant setup. At runtime you can manage per-plant connections and query templates by duplicating the example files under `config/`.

## Scripts

- `npm run dev` – start development server with hot reload
- `npm run build` – compile TypeScript to `dist/`
- `npm start` – run compiled server
- `npm run lint` – lint sources with ESLint + Prettier

## Deployment (systemd example)

```
[Unit]
Description=Energy Connector
After=network.target

[Service]
WorkingDirectory=/opt/energy-connector
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## Esposizione del Connector su Internet

Per permettere al frontend deployato su Vercel di connettersi al connector locale, devi esporre il connector su internet.

### Opzione 1: ngrok (Semplice - Per Test)

1. **Installa ngrok** da https://ngrok.com/download
2. **Configura authtoken:**
   ```powershell
   ngrok config add-authtoken <tuo-token>
   ```
   Trova il token su https://dashboard.ngrok.com/get-started/your-authtoken

3. **Avvia tunnel:**
   ```powershell
   .\scripts\start-ngrok.ps1
   ```
   Oppure manualmente:
   ```powershell
   ngrok http 3001
   ```

4. **Copia l'URL HTTPS** (es: `https://abc123.ngrok.io`) e configuralo nel frontend:
   - Aggiungi a `.env.local` del frontend: `VITE_CONNECTOR_URL=https://abc123.ngrok.io`
   - Configura su Vercel nelle Environment Variables

**Nota**: ngrok gratuito ha limiti (URL cambia ad ogni riavvio, limite richieste/minuto)

### Opzione 2: Cloudflare Tunnel (Consigliato - Stabile e Gratuito)

Vedi `scripts/setup-tunnel.md` per istruzioni complete.

Cloudflare Tunnel offre:
- URL stabile (puoi usare un dominio personalizzato)
- Gratuito
- Più sicuro
- Nessun limite pratico

### Opzione 3: Deploy del Connector (Produzione)

Per un ambiente stabile, deploya il connector su:
- **Railway** (https://railway.app) - Gratuito per iniziare
- **Render** (https://render.com) - Free tier disponibile
- **VPS** (DigitalOcean, Hetzner, etc.) - ~5€/mese

Il connector deve essere deployato sulla stessa rete del cliente per accedere a InfluxDB locale, oppure configura InfluxDB per essere accessibile tramite VPN.

## TODO / Next steps

- Implement real InfluxDB client and export pipeline (JSONL + compression)
- Persist job state and artifacts to disk
- Implement SSE/WebSocket progress channel
- Integrate anchoring via ethers.js
- Harden authentication (PIN provisioning, TOTP, audit log)
- Integrate frontend with connector API
