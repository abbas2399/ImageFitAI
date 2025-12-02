// src/jobs/dto/create-job.dto.ts

import { IsString, IsNotEmpty } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @IsString()
  @IsNotEmpty()
  rulesText: string;
}