# Setup script per InfluxDB locale
# Verifica che InfluxDB sia avviato e crea il file .env.local per il connector

$INFLUX_URL = "http://localhost:8086"
$INFLUX_ORG = "energy-org"
$INFLUX_BUCKET = "energy-data"
$INFLUX_TOKEN = "energy-connector-token-dev-local-only"
$INFLUX_USERNAME = "admin"
$INFLUX_PASSWORD = "admin123456"

Write-Host "🔧 Configurazione InfluxDB locale..." -ForegroundColor Cyan

# Verifica che Docker sia in esecuzione
Write-Host "Verifica Docker Desktop..." -ForegroundColor Yellow
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker Desktop non è in esecuzione. Avvia Docker Desktop e riprova." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Docker Desktop è in esecuzione" -ForegroundColor Green
} catch {
    Write-Host "❌ Errore durante la verifica di Docker: $_" -ForegroundColor Red
    exit 1
}

# Verifica che il container InfluxDB sia in esecuzione
Write-Host "Verifica container InfluxDB..." -ForegroundColor Yellow
$containerStatus = docker ps --filter "name=energy-influxdb" --format "{{.Status}}"
if (-not $containerStatus) {
    Write-Host "⚠️  Container InfluxDB non trovato. Avvio con docker-compose..." -ForegroundColor Yellow
    docker-compose up -d
    Start-Sleep -Seconds 10
} else {
    Write-Host "✅ Container InfluxDB è in esecuzione: $containerStatus" -ForegroundColor Green
}

# Attendi che InfluxDB sia pronto
Write-Host "Attesa inizializzazione InfluxDB..." -ForegroundColor Yellow
$maxRetries = 30
$retryCount = 0
$isReady = $false

while ($retryCount -lt $maxRetries -and -not $isReady) {
    try {
        $response = Invoke-WebRequest -Uri "$INFLUX_URL/health" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $isReady = $true
            Write-Host "✅ InfluxDB è pronto" -ForegroundColor Green
        }
    } catch {
        $retryCount++
        Write-Host "  Tentativo $retryCount/$maxRetries..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $isReady) {
    Write-Host "❌ InfluxDB non è pronto dopo $maxRetries tentativi" -ForegroundColor Red
    exit 1
}

# Crea il file .env.local
$envLocalPath = Join-Path $PSScriptRoot "..\.env.local"
$envLines = @(
    "# InfluxDB Local Configuration",
    "INFLUX_URL=$INFLUX_URL",
    "INFLUX_ORG=$INFLUX_ORG",
    "INFLUX_BUCKET=$INFLUX_BUCKET",
    "INFLUX_TOKEN=$INFLUX_TOKEN",
    "",
    "# Connector Configuration",
    "CONNECTOR_PORT=3001",
    "SESSION_TTL_SECONDS=900",
    "LOG_LEVEL=info",
    "CONNECTOR_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000"
)

Write-Host "Creazione file .env.local..." -ForegroundColor Yellow
$envLines | Out-File -FilePath $envLocalPath -Encoding UTF8 -Force
Write-Host "✅ File .env.local creato in: $envLocalPath" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Setup completato!" -ForegroundColor Green
Write-Host ""
Write-Host "Credenziali InfluxDB:" -ForegroundColor Cyan
Write-Host "  URL: $INFLUX_URL" -ForegroundColor White
Write-Host "  Org: $INFLUX_ORG" -ForegroundColor White
Write-Host "  Bucket: $INFLUX_BUCKET" -ForegroundColor White
Write-Host "  Token: $INFLUX_TOKEN" -ForegroundColor White
Write-Host "  Username: $INFLUX_USERNAME" -ForegroundColor White
Write-Host "  Password: $INFLUX_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host ('Web UI: ' + $INFLUX_URL) -ForegroundColor Cyan

