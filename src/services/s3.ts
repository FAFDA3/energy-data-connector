import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadConfig } from '../config/index.js';

let s3Client: S3Client | null = null;

/**
 * Inizializza il client S3 con le credenziali da configurazione
 */
function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  const config = loadConfig();
  const { region, accessKeyId, secretAccessKey, bucket } = config.s3;

  if (!region || !bucket) {
    throw new Error('AWS S3 configuration missing: AWS_REGION and AWS_S3_BUCKET are required');
  }

  // Se abbiamo access key e secret, usali, altrimenti usa IAM Role (per EC2/Lambda)
  const credentials = accessKeyId && secretAccessKey
    ? {
        accessKeyId,
        secretAccessKey,
      }
    : undefined; // Se undefined, AWS SDK userà IAM Role automaticamente

  s3Client = new S3Client({
    region,
    credentials,
  });

  return s3Client;
}

/**
 * Upload di un file su S3
 * @param fileBuffer Buffer del file da uploadare
 * @param fileName Nome del file originale
 * @param fileHash Hash SHA-256 del file (opzionale, usato per generare S3 key)
 * @param metadata Metadati opzionali da aggiungere come tag S3
 * @returns S3 key del file uploadato
 */
export async function uploadFileToS3(
  fileBuffer: Buffer,
  fileName: string,
  fileHash?: string,
  metadata?: Record<string, string>
): Promise<string> {
  const config = loadConfig();
  const { bucket } = config.s3;

  if (!bucket) {
    throw new Error('AWS_S3_BUCKET not configured');
  }

  const client = getS3Client();

  // Genera S3 key con struttura: {year}/{month}/{file_hash}.json
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Usa fileHash se disponibile, altrimenti genera un hash temporaneo
  const hashForKey = fileHash || `file-${Date.now()}`;
  const extension = fileName.split('.').pop() || 'json';
  const s3Key = `${year}/${month}/${hashForKey}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: 'application/json',
    Metadata: metadata || {},
  });

  try {
    await client.send(command);
    return s3Key;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Genera un presigned URL per scaricare un file da S3
 * @param fileKey S3 key del file
 * @param expiresIn Secondi di validità dell'URL (default: 1 ora)
 * @returns Presigned URL
 */
export async function getPresignedUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
  const config = loadConfig();
  const { bucket } = config.s3;

  if (!bucket) {
    throw new Error('AWS_S3_BUCKET not configured');
  }

  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: fileKey,
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verifica se S3 è configurato correttamente
 */
export function isS3Configured(): boolean {
  try {
    const config = loadConfig();
    return !!(config.s3?.region && config.s3?.bucket);
  } catch {
    return false;
  }
}

