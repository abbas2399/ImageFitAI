// src/jobs/jobs.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Job, JobStatus } from './entities/job.entity';
import { S3Service } from '../s3/s3.service';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { LlmService } from '../llm/llm.service';
import { CreateJobDto } from '../uploads/dto/create-job.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private jobs: Map<string, Job> = new Map(); // In-memory storage for MVP

  constructor(
    private s3Service: S3Service,
    private ffmpegService: FfmpegService,
    private llmService: LlmService,
  ) {}

  /**
   * Create and process a job
   */
  async createJob(createJobDto: CreateJobDto): Promise<Job> {
    const jobId = uuidv4();
    const job: Job = {
      jobId,
      s3Key: createJobDto.s3Key,
      rulesText: createJobDto.rulesText,
      status: JobStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.logger.log(`Job created: ${jobId}`);

    // Process job asynchronously
    this.processJob(jobId).catch((error) => {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      this.updateJobStatus(jobId, JobStatus.FAILED, { error: error.message });
    });

    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return job;
  }

  /**
   * Process a job (main orchestration logic)
   */
  private async processJob(jobId: string): Promise<void> {
    this.logger.log(`Processing job: ${jobId}`);
    this.updateJobStatus(jobId, JobStatus.PROCESSING);

    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    const workDir = path.join(os.tmpdir(), 'ica', `job-${jobId}`);

    try {
      // Create working directory
      fs.mkdirSync(workDir, { recursive: true });
      this.logger.log(`Created working directory: ${workDir}`);

      // Step 1: Download image from S3
      const inputFileName = path.basename(job.s3Key);
      const inputPath = path.join(workDir, inputFileName);
      
      this.logger.log(`Downloading from S3: ${job.s3Key}`);
      await this.s3Service.downloadFile(job.s3Key, inputPath);

      // Step 2: Extract metadata
      this.logger.log('Extracting metadata...');
      const metadata = await this.ffmpegService.extractMetadata(inputPath);
      this.logger.log(`Metadata: ${JSON.stringify(metadata)}`);

      // Step 3: Call LLM to generate commands
      this.logger.log('Generating ffmpeg commands...');
      const llmResponse = await this.llmService.generateCommands(
        job.rulesText,
        metadata,
        inputFileName,
      );

      // Step 4: Execute ffmpeg commands
      this.logger.log('Executing ffmpeg commands...');
      await this.ffmpegService.executeCommands(llmResponse.commands, workDir);

      // Step 5: Validate output
      const outputPath = path.join(workDir, llmResponse.finalOutput);
      this.logger.log('Validating output...');
      const validation = await this.ffmpegService.validateOutput(
        outputPath,
        llmResponse.constraints,
      );

      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 6: Upload result to S3
      const outputS3Key = `outputs/${jobId}/${llmResponse.finalOutput}`;
      this.logger.log(`Uploading result to S3: ${outputS3Key}`);
      await this.s3Service.uploadFile(outputPath, outputS3Key);

      // Step 7: Generate presigned URLs for download
      const originalImageUrl = await this.s3Service.generatePresignedDownloadUrl(
        job.s3Key,
      );
      const outputImageUrl = await this.s3Service.generatePresignedDownloadUrl(
        outputS3Key,
      );

      // Step 8: Update job with success
      this.updateJobStatus(jobId, JobStatus.COMPLETED, {
        originalImageUrl,
        outputImageUrl,
        summary: llmResponse.summary,
        commands: llmResponse.commands,
        constraints: llmResponse.constraints,
      });

      this.logger.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      this.updateJobStatus(jobId, JobStatus.FAILED, {
        error: error.message,
      });
    } finally {
      // Cleanup: Remove working directory
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
        this.logger.log(`Cleaned up working directory: ${workDir}`);
      }
    }
  }

  /**
   * Update job status and additional fields
   */
  private updateJobStatus(
    jobId: string,
    status: JobStatus,
    updates: Partial<Job> = {},
  ): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.updatedAt = new Date();
      Object.assign(job, updates);
      this.jobs.set(jobId, job);
    }
  }
}