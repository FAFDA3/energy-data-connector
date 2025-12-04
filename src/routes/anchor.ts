import { Router } from 'express';
import { z } from 'zod';
import { getMachineIP } from '../utils/network.js';

const router = Router();

const anchorSchema = z.object({
  fileSha256: z.string(),
  datasetName: z.string(),
  timeStart: z.string(),
  timeEnd: z.string(),
  metadata: z.record(z.any()).optional(),
});

router.post('/', (req, res) => {
  const parsed = anchorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  // Ottieni IP della macchina
  const machineIP = getMachineIP();
  
  // Aggiungi IP e timestamp ai metadati
  let enhancedMetadata: Record<string, any> = {
    machineIP: machineIP,
    anchoredAt: new Date().toISOString(),
  };
  
  // Se ci sono metadati esistenti, uniscili
  if (parsed.data.metadata) {
    enhancedMetadata = {
      ...parsed.data.metadata,
      ...enhancedMetadata,
    };
  }

  // TODO: integrate with actual anchoring logic (ethers.js)
  // Passa enhancedMetadata come stringa JSON nel campo metadata del contratto
  const fakeTxHash = '0x' + '0'.repeat(64);
  return res.json({ 
    txHash: fakeTxHash, 
    status: 'queued',
    metadata: enhancedMetadata 
  });
});

export const anchorRouter = router;
