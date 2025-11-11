import { Router } from 'express';
import { z } from 'zod';
import { createJob, getJob, updateJob } from '../services/jobManager.js';

const router = Router();

const exportSchema = z.object({
  start: z.string(),
  end: z.string(),
  datasets: z.array(z.string()).optional(),
});

router.post('/export', (req, res) => {
  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const job = createJob();
  updateJob(job.id, { state: 'running', progress: 0 });

  // TODO: replace with real export pipeline.
  setTimeout(() => {
    updateJob(job.id, {
      state: 'done',
      progress: 1,
      rowCount: 0,
      outputFile: `data/${job.id}.jsonl.zst`,
      manifestFile: `data/${job.id}.manifest.json`,
      sha256: 'pending',
    });
  }, 1000);

  return res.status(202).json({ jobId: job.id });
});

router.get('/status/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json(job);
});

router.get('/download/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job || job.state !== 'done' || !job.outputFile) {
    return res.status(404).json({ error: 'Job not ready' });
  }
  // Placeholder: actual implementation should stream the file contents.
  return res.status(501).json({ error: 'Download not yet implemented' });
});

export const bulkRouter = router;
