# Script per popolare InfluxDB con dati demo di energia
# Genera serie temporali realistiche per testare il connector

$INFLUX_URL = "http://localhost:8086"
$INFLUX_ORG = "energy-org"
$INFLUX_BUCKET = "energy-data"
$INFLUX_TOKEN = "energy-connector-token-dev-local-only"

Write-Host "🌱 Popolazione InfluxDB con dati demo..." -ForegroundColor Cyan

# Verifica che InfluxDB sia pronto
try {
    $healthCheck = Invoke-WebRequest -Uri "$INFLUX_URL/health" -Method Get -TimeoutSec 5
    if ($healthCheck.StatusCode -ne 200) {
        Write-Host "❌ InfluxDB non è pronto" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Errore durante la connessione a InfluxDB: $_" -ForegroundColor Red
    Write-Host "Assicurati che InfluxDB sia avviato (esegui scripts\setup-influxdb.ps1 prima)" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Connesso a InfluxDB" -ForegroundColor Green

# Funzione per generare dati in formato Line Protocol
function New-InfluxLineProtocol {
    param(
        [string]$Measurement,
        [string]$Tags,
        [hashtable]$Fields,
        [DateTime]$Timestamp
    )
    
    $fieldStr = ($Fields.Keys | ForEach-Object { "$_=$($Fields[$_])" }) -join ","
    $nanoTimestamp = [long]($Timestamp.ToUniversalTime().Subtract([DateTime]::Parse("1970-01-01")).TotalSeconds * 1000000000)
    
    return "$Measurement,$Tags $fieldStr $nanoTimestamp"
}

# Genera dati per gli ultimi 7 giorni
Write-Host "Generazione dati per gli ultimi 7 giorni..." -ForegroundColor Yellow

$endDate = [DateTime]::UtcNow
$startDate = $endDate.AddDays(-7)
$interval = [TimeSpan]::FromMinutes(15) # Dati ogni 15 minuti

$lines = @()
$currentDate = $startDate

# Sensori disponibili
$sensors = @(
    @{location="building-a"; type="consumption"; unit="kWh"},
    @{location="building-b"; type="consumption"; unit="kWh"},
    @{location="building-c"; type="consumption"; unit="kWh"},
    @{location="solar-panel-1"; type="production"; unit="kW"},
    @{location="solar-panel-2"; type="production"; unit="kW"},
    @{location="wind-turbine-1"; type="production"; unit="kW"}
)

$random = New-Object System.Random
$counter = 0

while ($currentDate -le $endDate) {
    foreach ($sensor in $sensors) {
        # Genera valori realistici con variazioni casuali
        if ($sensor.type -eq "consumption") {
            # Consumi: base 50-200 kWh con pattern giornaliero (più alti durante il giorno)
            $hourOfDay = $currentDate.Hour
            $baseValue = if ($hourOfDay -ge 6 -and $hourOfDay -le 22) { 150 } else { 80 }
            $value = $baseValue + ($random.NextDouble() * 100 - 50) # Variazione ±50
            $value = [Math]::Max(20, $value) # Minimo 20 kWh
        } else {
            # Produzione: 0-300 kW (dipendente da ora del giorno per solare)
            if ($sensor.location -like "solar-*") {
                $hourOfDay = $currentDate.Hour
                if ($hourOfDay -ge 6 -and $hourOfDay -le 18) {
                    $baseValue = 200 * [Math]::Sin(($hourOfDay - 6) * [Math]::PI / 12)
                } else {
                    $baseValue = 0
                }
                $value = [Math]::Max(0, $baseValue + ($random.NextDouble() * 50 - 25))
            } else {
                # Eolico: più variabile
                $value = 50 + ($random.NextDouble() * 200)
            }
        }
        
        $line = New-InfluxLineProtocol -Measurement "energy" `
            -Tags "location=$($sensor.location),type=$($sensor.type),unit=$($sensor.unit)" `
            -Fields @{value=$([Math]::Round($value, 2))} `
            -Timestamp $currentDate
        
        $lines += $line
        $counter++
    }
    
    $currentDate = $currentDate.Add($interval)
    
    # Invia batch ogni 1000 righe per evitare payload troppo grandi
    if ($lines.Count -ge 1000) {
        $body = $lines -join "`n"
        try {
            $headers = @{
                "Authorization" = "Token $INFLUX_TOKEN"
                "Content-Type" = "text/plain; charset=utf-8"
            }
            $response = Invoke-WebRequest -Uri "$INFLUX_URL/api/v2/write?org=$INFLUX_ORG&bucket=$INFLUX_BUCKET&precision=ns" `
                -Method Post -Headers $headers -Body $body -TimeoutSec 30
            
            Write-Host "  Inserite $($lines.Count) misurazioni..." -ForegroundColor Gray
            $lines = @()
        } catch {
            Write-Host "❌ Errore durante l'inserimento: $_" -ForegroundColor Red
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "Risposta: $responseBody" -ForegroundColor Red
            }
        }
    }
}

# Invia le righe rimanenti
if ($lines.Count -gt 0) {
    $body = $lines -join "`n"
    try {
        $headers = @{
            "Authorization" = "Token $INFLUX_TOKEN"
            "Content-Type" = "text/plain; charset=utf-8"
        }
        $response = Invoke-WebRequest -Uri "$INFLUX_URL/api/v2/write?org=$INFLUX_ORG&bucket=$INFLUX_BUCKET&precision=ns" `
            -Method Post -Headers $headers -Body $body -TimeoutSec 30
        
        Write-Host "  Inserite $($lines.Count) misurazioni finali..." -ForegroundColor Gray
    } catch {
        Write-Host "❌ Errore durante l'inserimento finale: $_" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Risposta: $responseBody" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "✅ Dati demo inseriti: $counter misurazioni totali" -ForegroundColor Green
Write-Host ""
Write-Host "Dati disponibili per:" -ForegroundColor Cyan
Write-Host "  - 3 sensori di consumo (building-a, building-b, building-c)" -ForegroundColor White
Write-Host "  - 2 pannelli solari (solar-panel-1, solar-panel-2)" -ForegroundColor White
Write-Host "  - 1 turbina eolica (wind-turbine-1)" -ForegroundColor White
Write-Host "  - Periodo: ultimi 7 giorni (dati ogni 15 minuti)" -ForegroundColor White
Write-Host ""
Write-Host "Puoi visualizzare i dati su: $INFLUX_URL" -ForegroundColor Cyan

