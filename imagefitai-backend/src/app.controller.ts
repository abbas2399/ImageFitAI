
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

// src/app.controller.ts

import { Controller, Get } from '@nestjs/common';
import { S3Service } from './s3/s3.service';

@Controller()
export class AppController {
  constructor(private s3Service: S3Service) {}

  @Get()
  getHello() {
    return { 
      message: 'ImageFitAI Backend is running!',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  async healthCheck() {
    try {
      // Try to generate a test presigned URL
      const result = await this.s3Service.generatePresignedUploadUrl('health-check.jpg');
      
      return { 
        status: 'ok',
        s3: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        s3: 'failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

