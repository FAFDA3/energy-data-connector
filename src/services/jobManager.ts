import { randomUUID } from 'crypto';

export type JobState = 'pending' | 'running' | 'done' | 'error';

export type ExportJob = {
  id: string;
  state: JobState;
  createdAt: number;
  updatedAt: number;
  progress: number; // 0..1
  rowCount: number;
  error?: string;
  outputFile?: string;
  manifestFile?: string;
  sha256?: string;
};

const jobs = new Map<string, ExportJob>();

export function createJob(): ExportJob {
  const id = randomUUID();
  const now = Date.now();
  const job: ExportJob = {
    id,
    state: 'pending',
    createdAt: now,
    updatedAt: now,
    progress: 0,
    rowCount: 0,
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<ExportJob>): ExportJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  const updated: ExportJob = {
    ...job,
    ...patch,
    updatedAt: Date.now(),
  };
  jobs.set(id, updated);
  return updated;
}

export function getJob(id: string): ExportJob | undefined {
  return jobs.get(id);
}

export function listJobs(): ExportJob[] {
  return Array.from(jobs.values());
}
