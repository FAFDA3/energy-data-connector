# Script per avviare ngrok e esporre il connector
# Prerequisito: ngrok installato e authtoken configurato

Write-Host "🚇 Avvio tunnel ngrok per connector..." -ForegroundColor Cyan

# Verifica che ngrok sia installato
try {
    $ngrokVersion = ngrok version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "ngrok non trovato"
    }
} catch {
    Write-Host "❌ ngrok non trovato!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installa ngrok:" -ForegroundColor Yellow
    Write-Host "1. Scarica da https://ngrok.com/download" -ForegroundColor White
    Write-Host "2. Estrai e aggiungi al PATH" -ForegroundColor White
    Write-Host "3. Esegui: ngrok config add-authtoken <tuo-token>" -ForegroundColor White
    Write-Host "   (trova il token su https://dashboard.ngrok.com/get-started/your-authtoken)" -ForegroundColor Gray
    exit 1
}

# Verifica che il connector sia in esecuzione
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -ne 200) {
        throw "Connector non risponde"
    }
} catch {
    Write-Host "⚠️  Connector non risponde su localhost:3001" -ForegroundColor Yellow
    Write-Host "Avvia prima il connector con: npm run dev" -ForegroundColor White
    exit 1
}

Write-Host "✅ Connector attivo su localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "Avvio tunnel ngrok..." -ForegroundColor Yellow
Write-Host "Copia l'URL 'Forwarding' che apparirà e usalo nel frontend" -ForegroundColor Cyan
Write-Host ""
Write-Host "Premi Ctrl+C per fermare il tunnel" -ForegroundColor Gray
Write-Host ""

# Avvia ngrok
ngrok http 3001

