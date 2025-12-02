// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsModule } from './uploads/uploads.module';
import { JobsModule } from './jobs/jobs.module';
import { S3Module } from './s3/s3.module';
import { LlmModule } from './llm/llm.module';
import { FfmpegModule } from './ffmpeg/ffmpeg.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available everywhere
    }),
    UploadsModule,
    JobsModule,
    S3Module,
    LlmModule,
    FfmpegModule,
  ],
})
export class AppModule {}