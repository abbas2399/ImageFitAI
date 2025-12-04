// src/uploads/uploads.module.ts

import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [S3Module],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}