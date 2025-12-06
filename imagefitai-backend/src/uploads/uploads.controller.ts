
import { Controller } from '@nestjs/common';

@Controller('uploads')
export class UploadsController {}

// src/uploads/uploads.controller.ts

import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { PresignUrlDto } from './dto/presign-url.dto';

@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  async getPresignedUrl(@Body() presignUrlDto: PresignUrlDto) {
    try {
      this.logger.log(`Generating presigned URL for: ${presignUrlDto.fileName}`);
      const result = await this.uploadsService.generatePresignedUrl(presignUrlDto.fileName);
      this.logger.log(`Successfully generated presigned URL`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        error.message || 'Failed to generate presigned URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

