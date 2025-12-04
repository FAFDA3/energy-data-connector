import { networkInterfaces } from 'os';

/**
 * Ottiene l'IP della macchina (priorità: IPv4 non loopback)
 */
export function getMachineIP(): string {
  const interfaces = networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;
    
    for (const net of nets) {
      // Skip loopback e IPv6
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  
  // Fallback: localhost
  return '127.0.0.1';
}

