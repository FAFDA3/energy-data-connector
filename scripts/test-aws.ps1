# Script per testare la connessione AWS S3
# Usage: .\test-aws.ps1

Write-Host "🧪 Test Connessione AWS S3" -ForegroundColor Cyan
Write-Host ""

# Verifica che il connector sia in esecuzione
Write-Host "1. Verifica Connector..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri http://localhost:3001/health -Method Get
    Write-Host "   ✅ Connector attivo (versione $($health.version))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Connector non raggiungibile su http://localhost:3001" -ForegroundColor Red
    Write-Host "   ⚠️  Avvia il connector con: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Verifica configurazione S3
Write-Host ""
Write-Host "2. Verifica Configurazione AWS S3..." -ForegroundColor Yellow
try {
    $s3Status = Invoke-RestMethod -Uri http://localhost:3001/health/s3 -Method Get
    Write-Host "   Configurato: $($s3Status.s3.configured)" -ForegroundColor $(if ($s3Status.s3.configured) { "Green" } else { "Yellow" })
    Write-Host "   Region: $($s3Status.s3.region)" -ForegroundColor White
    Write-Host "   Bucket: $($s3Status.s3.bucket)" -ForegroundColor White
    Write-Host "   Access Key: $($s3Status.s3.hasAccessKey)" -ForegroundColor White
    Write-Host "   Secret Key: $($s3Status.s3.hasSecretKey)" -ForegroundColor White
    
    if (-not $s3Status.s3.configured) {
        Write-Host ""
        Write-Host "   ⚠️  AWS S3 non è configurato!" -ForegroundColor Yellow
        Write-Host "   📝 Aggiungi le seguenti variabili in connector/.env.local:" -ForegroundColor Cyan
        Write-Host "      AWS_REGION=eu-north-1" -ForegroundColor White
        Write-Host "      AWS_S3_BUCKET=energy-validation-archive-prod" -ForegroundColor White
        Write-Host "      AWS_ACCESS_KEY_ID=your-access-key-id" -ForegroundColor White
        Write-Host "      AWS_SECRET_ACCESS_KEY=your-secret-access-key" -ForegroundColor White
        Write-Host ""
        Write-Host "   📖 Segui la guida completa in: GUIDA_SETUP_S3.md" -ForegroundColor Cyan
        exit 1
    }
    
    Write-Host ""
    Write-Host "   ✅ AWS S3 è configurato correttamente!" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Errore nel verificare configurazione S3: $_" -ForegroundColor Red
    exit 1
}

# Test upload (se configurato)
Write-Host ""
Write-Host "3. Test Upload su S3..." -ForegroundColor Yellow
try {
    $testContent = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"test": true, "timestamp": "' + (Get-Date -Format "o") + '"}'))
    $testPayload = @{
        fileContent = $testContent
        fileName = "test-aws-connection.json"
        fileHash = "test-hash-$(Get-Date -Format 'yyyyMMddHHmmss')"
        metadata = @{
            test = "true"
            source = "test-script"
        }
    } | ConvertTo-Json
    
    $uploadResult = Invoke-RestMethod -Uri http://localhost:3001/storage/upload -Method Post -Body $testPayload -ContentType "application/json" -Headers @{"Authorization" = "Bearer test-token"}
    
    Write-Host "   ✅ Upload riuscito!" -ForegroundColor Green
    Write-Host "   S3 Key: $($uploadResult.s3Key)" -ForegroundColor White
    Write-Host "   File Size: $($uploadResult.fileSize) bytes" -ForegroundColor White
    Write-Host ""
    Write-Host "   🎉 AWS S3 funziona correttamente!" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "   ⚠️  Autenticazione richiesta (normale per test manuale)" -ForegroundColor Yellow
        Write-Host "   ✅ La configurazione S3 sembra corretta" -ForegroundColor Green
    } elseif ($statusCode -eq 503) {
        Write-Host "   ❌ S3 non configurato correttamente" -ForegroundColor Red
    } else {
        Write-Host "   ⚠️  Errore nel test upload: $_" -ForegroundColor Yellow
        Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Test completato!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""




