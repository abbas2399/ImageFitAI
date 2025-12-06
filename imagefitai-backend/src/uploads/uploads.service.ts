
import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadsService {}

// src/uploads/uploads.service.ts

import { Injectable } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class UploadsService {
  constructor(private s3Service: S3Service) {}

  async generatePresignedUrl(fileName: string) {
    const { uploadUrl, s3Key } = await this.s3Service.generatePresignedUploadUrl(
      fileName,
    );

    return {
      uploadUrl,
      s3Key,
    };
  }
}

