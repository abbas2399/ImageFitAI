// src/jobs/entities/job.entity.ts

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Job {
  jobId: string;
  s3Key: string;
  rulesText: string;
  status: JobStatus;
  originalImageUrl?: string;
  outputImageUrl?: string;
  summary?: string;
  commands?: string[];
  constraints?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}