import { Router } from 'express';
import { z } from 'zod';
import { uploadFileToS3, getPresignedUrl, isS3Configured } from '../services/s3.js';

const router = Router();

const uploadSchema = z.object({
  fileContent: z.string(), // Base64 encoded file content
  fileName: z.string(),
  fileHash: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * POST /storage/upload
 * Upload file su S3 dopo ancoraggio
 */
router.post('/upload', async (req, res) => {
  try {
    if (!isS3Configured()) {
      return res.status(503).json({ 
        error: 'S3 not configured', 
        message: 'AWS S3 configuration is missing. Please configure AWS_REGION and AWS_S3_BUCKET.' 
      });
    }

    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid payload', 
        details: parsed.error.flatten() 
      });
    }

    const { fileContent, fileName, fileHash, metadata } = parsed.data;

    // Decodifica base64
    let fileBuffer: Buffer;
    try {
      // Rimuovi data URL prefix se presente (es: "data:application/json;base64,...")
      const base64Content = fileContent.includes(',') 
        ? fileContent.split(',')[1] 
        : fileContent;
      fileBuffer = Buffer.from(base64Content, 'base64');
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid file content', 
        message: 'File content must be base64 encoded' 
      });
    }

    // Prepara metadata per S3
    const s3Metadata: Record<string, string> = {
      fileName,
      uploadedAt: new Date().toISOString(),
    };

    if (fileHash) {
      s3Metadata.fileHash = fileHash;
    }

    if (metadata) {
      // Aggiungi metadata come stringhe (S3 metadata deve essere string)
      Object.entries(metadata).forEach(([key, value]) => {
        s3Metadata[`meta_${key}`] = String(value);
      });
    }

    // Upload su S3
    const s3Key = await uploadFileToS3(fileBuffer, fileName, fileHash, s3Metadata);

    // Genera presigned URL temporaneo (1 ora)
    const presignedUrl = await getPresignedUrl(s3Key, 3600);

    return res.json({
      success: true,
      s3Key,
      s3Url: presignedUrl,
      fileName,
      fileSize: fileBuffer.length,
      metadata: s3Metadata,
    });
  } catch (error) {
    console.error('Error uploading to S3:', error);
    return res.status(500).json({ 
      error: 'Upload failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /storage/presigned-url/:fileHash
 * Genera presigned URL per un file esistente (solo admin in futuro)
 */
router.get('/presigned-url/:fileHash', async (req, res) => {
  try {
    if (!isS3Configured()) {
      return res.status(503).json({ 
        error: 'S3 not configured' 
      });
    }

    const { fileHash } = req.params;
    const expiresIn = req.query.expiresIn 
      ? Number(req.query.expiresIn) 
      : 3600; // Default 1 ora

    // TODO: Verificare che l'utente sia admin
    // Per ora, assumiamo che il fileHash corrisponda alla struttura S3
    // In futuro, dovremmo cercare il fileHash nel database per ottenere s3Key

    // Per ora, assumiamo che s3Key sia nella forma: {year}/{month}/{fileHash}.json
    // Questo è un workaround - in produzione dovremmo cercare nel database
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const s3Key = `${year}/${month}/${fileHash}.json`;

    const presignedUrl = await getPresignedUrl(s3Key, expiresIn);

    return res.json({
      success: true,
      s3Key,
      s3Url: presignedUrl,
      expiresIn,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return res.status(500).json({ 
      error: 'Failed to generate URL', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /storage/download
 * Genera presigned URL per scaricare un file usando s3Key
 */
router.get('/download', async (req, res) => {
  try {
    if (!isS3Configured()) {
      return res.status(503).json({ 
        error: 'S3 not configured' 
      });
    }

    const s3Key = req.query.s3Key as string;
    if (!s3Key) {
      return res.status(400).json({ 
        error: 'Missing s3Key parameter' 
      });
    }

    const expiresIn = req.query.expiresIn 
      ? Number(req.query.expiresIn) 
      : 3600; // Default 1 ora

    const presignedUrl = await getPresignedUrl(s3Key, expiresIn);

    return res.json({
      success: true,
      s3Key,
      downloadUrl: presignedUrl,
      expiresIn,
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    return res.status(500).json({ 
      error: 'Failed to generate download URL', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export const storageRouter = router;

