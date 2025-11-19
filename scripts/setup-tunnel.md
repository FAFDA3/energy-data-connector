# Setup Tunnel per Connector Locale

## Opzione 1: Cloudflare Tunnel (Consigliato - Gratuito)

1. **Installa cloudflared:**
   - Windows: Scarica da https://github.com/cloudflare/cloudflared/releases
   - O usa winget: `winget install --id Cloudflare.cloudflared`

2. **Login e setup:**
   ```powershell
   cloudflared tunnel login
   cloudflared tunnel create energy-connector
   ```

3. **Crea file di configurazione** `config.yml` nella home:
   ```yaml
   tunnel: <tunnel-id>
   credentials-file: C:\Users\<tuo-username>\.cloudflared\<tunnel-id>.json
   
   ingress:
     - hostname: energy-connector.tuodominio.com
       service: http://localhost:3001
     - service: http_status:404
   ```

4. **Avvia tunnel:**
   ```powershell
   cloudflared tunnel run energy-connector
   ```

5. **Configura DNS su Cloudflare** per il dominio che hai scelto.

---

## Opzione 2: ngrok (Più Semplice - Limiti Free)

1. **Registrati su https://ngrok.com** (gratis)

2. **Scarica ngrok** e installa

3. **Configura il tuo auth token:**
   ```powershell
   ngrok config add-authtoken <tuo-token>
   ```

4. **Avvia tunnel:**
   ```powershell
   ngrok http 3001
   ```

5. **Copia l'URL** (es: `https://abc123.ngrok.io`) e usalo nel frontend

---

## Configurazione Frontend

Nel file `.env` del frontend (Vercel), aggiungi:

```env
VITE_CONNECTOR_URL=https://energy-connector.tuodominio.com
# oppure
VITE_CONNECTOR_URL=https://abc123.ngrok.io
```

