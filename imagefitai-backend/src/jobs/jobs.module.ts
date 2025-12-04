// src/jobs/jobs.module.ts

import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { S3Module } from '../s3/s3.module';
import { FfmpegModule } from '../ffmpeg/ffmpeg.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [S3Module, FfmpegModule, LlmModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}