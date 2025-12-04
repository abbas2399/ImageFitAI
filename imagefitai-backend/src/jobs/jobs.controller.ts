// src/jobs/jobs.controller.ts

import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from '../uploads/dto/create-job.dto';

@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(private readonly jobsService: JobsService) {}

  @Post()
  async createJob(@Body() createJobDto: CreateJobDto) {
    this.logger.log(`Creating job for S3 key: ${createJobDto.s3Key}`);
    const job = await this.jobsService.createJob(createJobDto);
    
    return {
      jobId: job.jobId,
      status: job.status,
    };
  }

  @Get(':id')
  async getJob(@Param('id') id: string) {
    this.logger.log(`Getting job status: ${id}`);
    return this.jobsService.getJob(id);
  }
}