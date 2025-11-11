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
 ├─ config/
 │   ├─ connections.example.json
 │   └─ queries.example.json
 ├─ .env.example
 └─ package.json
```

## Getting started

```bash
npm install
npm run dev
# Connector listens on http://localhost:3001 by default
```

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

## TODO / Next steps

- Implement real InfluxDB client and export pipeline (JSONL + compression)
- Persist job state and artifacts to disk
- Implement SSE/WebSocket progress channel
- Integrate anchoring via ethers.js
- Harden authentication (PIN provisioning, TOTP, audit log)
