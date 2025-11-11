import { Router } from 'express';
import { z } from 'zod';

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

  // TODO: integrate with actual anchoring logic (ethers.js)
  const fakeTxHash = '0x' + '0'.repeat(64);
  return res.json({ txHash: fakeTxHash, status: 'queued' });
});

export const anchorRouter = router;
