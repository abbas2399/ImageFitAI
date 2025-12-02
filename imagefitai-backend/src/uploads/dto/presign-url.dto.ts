// src/uploads/dto/presign-url.dto.ts

import { IsString, IsNotEmpty } from 'class-validator';

export class PresignUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;
}