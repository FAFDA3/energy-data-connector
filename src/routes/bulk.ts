import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { createJob, getJob, updateJob } from '../services/jobManager.js';
import { queryEnergyData } from '../services/influx.js';
import { getMachineIP } from '../utils/network.js';

const router = Router();

const exportSchema = z.object({
  start: z.string(),
  end: z.string(),
  measurement: z.string().optional().default('energy'),
  filters: z.record(z.string()).optional(),
  datasets: z.array(z.string()).optional(),
});

router.post('/export', async (req, res) => {
  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { start, end, measurement, filters } = parsed.data;
  const job = createJob();
  
  // Avvia job in modo asincrono
  updateJob(job.id, { state: 'running', progress: 0 });

  // Esegui export in background
  (async () => {
    try {
      console.log(`📊 Starting export job ${job.id} from ${start} to ${end}`);
      
      // Esegui query InfluxDB
      updateJob(job.id, { progress: 0.2, status: 'Querying InfluxDB...' });
      
      const data = await queryEnergyData({
        start,
        end,
        measurement,
        filters: filters || {},
      });

      if (!data || data.length === 0) {
        updateJob(job.id, {
          state: 'done',
          progress: 1,
          rowCount: 0,
          status: 'No data found',
        });
        return;
      }

      updateJob(job.id, { progress: 0.5, rowCount: data.length, status: 'Processing data...' });

      // Converti i dati in formato canonico (ogni record su una riga JSONL)
      // Per ora manteniamo i dati in memoria per il download
      const rowCount = data.length;

      // Calcola SHA-256 hash dei dati (JSONL canonico)
      try {
        const jsonlData = data.map(row => JSON.stringify(row)).join('\n') + '\n';
        const hash = createHash('sha256');
        hash.update(jsonlData, 'utf8');
        const sha256 = hash.digest('hex');

        // Aggiungi metadati con IP della macchina
        const machineIP = getMachineIP();
        const exportMetadata = {
          machineIP: machineIP,
          exportedAt: new Date().toISOString(),
          rowCount: rowCount,
          measurement: measurement,
          filters: filters || {},
        };

        updateJob(job.id, {
          state: 'done',
          progress: 1,
          rowCount,
          status: 'Export completed',
          outputFile: `${job.id}.jsonl`,
          sha256: `0x${sha256}`,
          metadata: exportMetadata,
          data: data, // Salva i dati in memoria per il download
        });
      } catch (err) {
        console.error('Error calculating hash:', err);
        updateJob(job.id, {
          state: 'done',
          progress: 1,
          rowCount,
          status: 'Export completed',
          outputFile: `${job.id}.jsonl`,
          sha256: 'error',
          data: data,
        });
      }

      console.log(`✅ Export job ${job.id} completed: ${rowCount} rows`);
    } catch (error) {
      console.error(`❌ Export job ${job.id} failed:`, error);
      updateJob(job.id, {
        state: 'error',
        progress: 0,
        status: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

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
  if (!job || job.state !== 'done') {
    return res.status(404).json({ error: 'Job not ready or not found' });
  }

  if (!job.data || job.data.length === 0) {
    return res.status(404).json({ error: 'No data available for this job' });
  }

  // Converti i dati in JSONL (JSON Lines) - formato canonico per export
  const jsonlLines = job.data.map(row => JSON.stringify(row));
  const jsonlContent = jsonlLines.join('\n') + '\n';

  // Imposta headers per download file
  const filename = job.outputFile || `${job.id}.jsonl`;
  res.setHeader('Content-Type', 'application/jsonl');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', Buffer.byteLength(jsonlContent, 'utf8'));

  // Invia i dati
  return res.send(jsonlContent);
});

export const bulkRouter = router;
