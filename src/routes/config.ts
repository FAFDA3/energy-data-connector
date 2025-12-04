import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from '../config/index.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GET /api/config - Legge configurazione attuale
router.get('/', (_req, res) => {
  try {
    const config = loadConfig();
    res.json({
      influx: config.influxDefault,
      blockchain: {
        rpcUrl: config.blockchain.rpcUrl,
        contractAddress: config.blockchain.contractAddress,
        // Non esporre private key per sicurezza
        hasPrivateKey: !!config.blockchain.privateKey,
      },
      connector: {
        port: config.connector.port,
        sessionTtlSeconds: config.connector.sessionTtlSeconds,
        logLevel: config.connector.logLevel,
        allowedOrigins: config.connector.allowedOrigins,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// POST /api/config - Aggiorna configurazione
router.post('/', async (req, res) => {
  try {
    const envPath = join(__dirname, '../../.env.local');
    let envContent = '';
    
    // Leggi file esistente o crea nuovo
    try {
      envContent = await readFile(envPath, 'utf-8');
    } catch {
      // File non esiste, crea nuovo
      envContent = '';
    }
    
    const updates = req.body;
    
    // Aggiorna valori
    if (updates.influx) {
      if (updates.influx.url) envContent = updateEnvLine(envContent, 'INFLUX_URL', updates.influx.url);
      if (updates.influx.org) envContent = updateEnvLine(envContent, 'INFLUX_ORG', updates.influx.org);
      if (updates.influx.bucket) envContent = updateEnvLine(envContent, 'INFLUX_BUCKET', updates.influx.bucket);
      if (updates.influx.token) envContent = updateEnvLine(envContent, 'INFLUX_TOKEN', updates.influx.token);
    }
    
    if (updates.blockchain) {
      if (updates.blockchain.rpcUrl) envContent = updateEnvLine(envContent, 'POLYGON_RPC_URL', updates.blockchain.rpcUrl);
      if (updates.blockchain.contractAddress) envContent = updateEnvLine(envContent, 'ANCHOR_CONTRACT_ADDRESS', updates.blockchain.contractAddress);
      if (updates.blockchain.privateKey) envContent = updateEnvLine(envContent, 'ANCHOR_PRIVATE_KEY', updates.blockchain.privateKey);
    }
    
    if (updates.connector) {
      if (updates.connector.port) envContent = updateEnvLine(envContent, 'CONNECTOR_PORT', updates.connector.port.toString());
      if (updates.connector.sessionTtlSeconds) envContent = updateEnvLine(envContent, 'SESSION_TTL_SECONDS', updates.connector.sessionTtlSeconds.toString());
      if (updates.connector.logLevel) envContent = updateEnvLine(envContent, 'LOG_LEVEL', updates.connector.logLevel);
      if (updates.connector.allowedOrigins) {
        const origins = Array.isArray(updates.connector.allowedOrigins) 
          ? updates.connector.allowedOrigins.join(',')
          : updates.connector.allowedOrigins;
        envContent = updateEnvLine(envContent, 'CONNECTOR_ALLOWED_ORIGINS', origins);
      }
    }
    
    await writeFile(envPath, envContent, 'utf-8');
    
    // Invalida cache configurazione
    // Nota: loadConfig ha un parametro forceReload ma non è esportato
    // Per ora richiediamo riavvio del server
    
    res.json({ 
      success: true, 
      message: 'Configuration updated. Please restart the server to apply changes.' 
    });
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: 'Failed to update config', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

function updateEnvLine(content: string, key: string, value: string): string {
  const lines = content.split('\n');
  const keyIndex = lines.findIndex(line => line.trim().startsWith(`${key}=`) && !line.trim().startsWith('#'));
  
  if (keyIndex >= 0) {
    lines[keyIndex] = `${key}=${value}`;
  } else {
    // Aggiungi alla fine se non esiste
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    content += `${key}=${value}\n`;
    return content;
  }
  
  return lines.join('\n');
}

export const configRouter = router;

