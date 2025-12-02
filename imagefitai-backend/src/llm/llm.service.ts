// src/llm/llm.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageMetadata } from '../ffmpeg/ffmpeg.service';

export interface LLMResponse {
  constraints: {
    format?: string;
    width?: number;
    height?: number;
    maxSize?: number; // in KB
    aspectRatio?: string;
  };
  commands: string[];
  finalOutput: string;
  summary: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Generate ffmpeg commands based on requirements and image metadata
   */
  async generateCommands(
    rulesText: string,
    metadata: ImageMetadata,
    inputFileName: string,
  ): Promise<LLMResponse> {
    this.logger.log('Generating commands from LLM...');
    this.logger.log(`Rules: ${rulesText}`);
    this.logger.log(`Current metadata: ${JSON.stringify(metadata)}`);

    // For MVP, we'll use a rule-based approach
    // Later, you can integrate with AWS Bedrock or OpenAI
    const response = this.parseRulesAndGenerateCommands(
      rulesText,
      metadata,
      inputFileName,
    );

    this.logger.log(`Generated ${response.commands.length} commands`);
    return response;
  }

  /**
   * Parse rules text and generate appropriate ffmpeg commands
   * This is a simplified version - in production, you'd use an actual LLM
   */
  private parseRulesAndGenerateCommands(
    rulesText: string,
    metadata: ImageMetadata,
    inputFileName: string,
  ): LLMResponse {
    const rules = rulesText.toLowerCase();
    const constraints: any = {};
    const commands: string[] = [];
    let outputFileName = 'output.jpg';

    // Parse format requirement
    if (rules.includes('jpeg') || rules.includes('jpg')) {
      constraints.format = 'jpeg';
      outputFileName = 'output.jpg';
    } else if (rules.includes('png')) {
      constraints.format = 'png';
      outputFileName = 'output.png';
    } else if (rules.includes('webp')) {
      constraints.format = 'webp';
      outputFileName = 'output.webp';
    }

    // Parse size requirement (e.g., "max 200KB", "under 500KB")
    const sizeMatch = rules.match(/(?:max|under|less than|below)\s+(\d+)\s*kb/i);
    if (sizeMatch) {
      constraints.maxSize = parseInt(sizeMatch[1]);
    }

    // Parse dimension requirements (e.g., "600x600", "1920x1080")
    const dimensionMatch = rules.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (dimensionMatch) {
      constraints.width = parseInt(dimensionMatch[1]);
      constraints.height = parseInt(dimensionMatch[2]);
    }

    // Parse aspect ratio (e.g., "1:1", "16:9")
    const aspectMatch = rules.match(/(?:aspect ratio|ratio)\s+(\d+):(\d+)/i);
    if (aspectMatch) {
      constraints.aspectRatio = `${aspectMatch[1]}:${aspectMatch[2]}`;
    }

    // Build ffmpeg command
    let command = `ffmpeg -i ${inputFileName}`;
    const filters: string[] = [];

    // Handle dimensions and aspect ratio
    if (constraints.width && constraints.height) {
      // If aspect ratio is specified, scale and pad
      if (constraints.aspectRatio) {
        filters.push(
          `scale=${constraints.width}:${constraints.height}:force_original_aspect_ratio=decrease`,
        );
        filters.push(
          `pad=${constraints.width}:${constraints.height}:(ow-iw)/2:(oh-ih)/2`,
        );
      } else {
        filters.push(`scale=${constraints.width}:${constraints.height}`);
      }
    }

    // Apply filters if any
    if (filters.length > 0) {
      command += ` -vf "${filters.join(',')}"`;
    }

    // Handle format conversion and compression
    if (constraints.format === 'jpeg') {
      command += ' -c:v mjpeg';
      
      // Add quality setting for JPEG compression
      if (constraints.maxSize) {
        // Lower quality for smaller file size
        // Quality scale: 2 (best) to 31 (worst)
        const quality = this.calculateJpegQuality(constraints.maxSize);
        command += ` -q:v ${quality}`;
      }
    } else if (constraints.format === 'png') {
      command += ' -c:v png';
    } else if (constraints.format === 'webp') {
      command += ' -c:v libwebp';
    }

    command += ` ${outputFileName}`;
    commands.push(command);

    // Generate summary
    const summary = this.generateSummary(metadata, constraints, outputFileName);

    return {
      constraints,
      commands,
      finalOutput: outputFileName,
      summary,
    };
  }

  /**
   * Calculate JPEG quality based on target file size
   */
  private calculateJpegQuality(targetSizeKB: number): number {
    // Simple heuristic: smaller target = lower quality
    if (targetSizeKB < 50) return 15;
    if (targetSizeKB < 100) return 10;
    if (targetSizeKB < 200) return 7;
    if (targetSizeKB < 500) return 5;
    return 3;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    originalMetadata: ImageMetadata,
    constraints: any,
    outputFileName: string,
  ): string {
    const parts: string[] = [];

    // Format conversion
    if (constraints.format) {
      parts.push(`Converted to ${constraints.format.toUpperCase()}`);
    }

    // Dimension changes
    if (constraints.width && constraints.height) {
      parts.push(
        `Resized from ${originalMetadata.width}x${originalMetadata.height} to ${constraints.width}x${constraints.height}`,
      );
    }

    // Size compression
    if (constraints.maxSize) {
      parts.push(`Compressed to meet ${constraints.maxSize}KB size limit`);
    }

    // Aspect ratio
    if (constraints.aspectRatio) {
      parts.push(`Adjusted to ${constraints.aspectRatio} aspect ratio`);
    }

    return parts.join(', ') + '.';
  }
}