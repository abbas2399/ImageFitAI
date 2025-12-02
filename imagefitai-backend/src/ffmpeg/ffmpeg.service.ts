// src/ffmpeg/ffmpeg.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  /**
   * Extract metadata from an image using ffprobe
   */
  async extractMetadata(imagePath: string): Promise<ImageMetadata> {
    try {
      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${imagePath}"`;
      const { stdout } = await execPromise(command);
      const data = JSON.parse(stdout);

      const videoStream = data.streams.find(
        (stream: any) => stream.codec_type === 'video',
      );

      if (!videoStream) {
        throw new Error('No video stream found in image');
      }

      const stats = fs.statSync(imagePath);

      return {
        width: videoStream.width,
        height: videoStream.height,
        format: data.format.format_name,
        size: stats.size,
      };
    } catch (error) {
      this.logger.error(`Failed to extract metadata: ${error.message}`);
      throw new Error(`Metadata extraction failed: ${error.message}`);
    }
  }

  /**
   * Validate and sanitize ffmpeg command
   */
  private validateCommand(command: string): boolean {
    // Must start with ffmpeg
    if (!command.trim().startsWith('ffmpeg')) {
      this.logger.warn(`Command does not start with ffmpeg: ${command}`);
      return false;
    }

    // Check for dangerous characters
    const dangerousPatterns = [';', '&&', '||', '|', '>', '<', '`', '$', '\\'];
    for (const pattern of dangerousPatterns) {
      if (command.includes(pattern)) {
        this.logger.warn(`Command contains dangerous pattern "${pattern}": ${command}`);
        return false;
      }
    }

    // Check for absolute paths (we want relative paths only)
    if (command.match(/\/[a-zA-Z0-9_\-\/]+/) && !command.includes('./')) {
      this.logger.warn(`Command contains absolute path: ${command}`);
      return false;
    }

    return true;
  }

  /**
   * Execute a single ffmpeg command in a sandbox directory
   */
  async executeCommand(
    command: string,
    workingDirectory: string,
    timeoutSeconds: number = 30,
  ): Promise<void> {
    // Validate command
    if (!this.validateCommand(command)) {
      throw new Error(`Invalid or dangerous command: ${command}`);
    }

    this.logger.log(`Executing command in ${workingDirectory}: ${command}`);

    try {
      const { stdout, stderr } = await execPromise(command, {
        cwd: workingDirectory,
        timeout: timeoutSeconds * 1000,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr) {
        this.logger.debug(`FFmpeg stderr: ${stderr}`);
      }

      this.logger.log(`Command executed successfully`);
    } catch (error) {
      this.logger.error(`Command execution failed: ${error.message}`);
      throw new Error(`FFmpeg command failed: ${error.message}`);
    }
  }

  /**
   * Execute multiple ffmpeg commands sequentially
   */
  async executeCommands(
    commands: string[],
    workingDirectory: string,
  ): Promise<void> {
    this.logger.log(`Executing ${commands.length} commands sequentially`);

    for (let i = 0; i < commands.length; i++) {
      this.logger.log(`Executing command ${i + 1}/${commands.length}`);
      await this.executeCommand(commands[i], workingDirectory);
    }

    this.logger.log(`All commands executed successfully`);
  }

  /**
   * Validate that output file meets constraints
   */
  async validateOutput(
    outputPath: string,
    constraints: any,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const metadata = await this.extractMetadata(outputPath);

      // Check format
      if (constraints.format) {
        const expectedFormat = constraints.format.toLowerCase();
        const actualFormat = metadata.format.toLowerCase();
        
        if (!actualFormat.includes(expectedFormat)) {
          errors.push(
            `Format mismatch: expected ${expectedFormat}, got ${actualFormat}`,
          );
        }
      }

      // Check dimensions
      if (constraints.width && metadata.width !== constraints.width) {
        errors.push(
          `Width mismatch: expected ${constraints.width}, got ${metadata.width}`,
        );
      }

      if (constraints.height && metadata.height !== constraints.height) {
        errors.push(
          `Height mismatch: expected ${constraints.height}, got ${metadata.height}`,
        );
      }

      // Check file size (convert KB to bytes)
      if (constraints.maxSize) {
        const maxSizeBytes = constraints.maxSize * 1024;
        if (metadata.size > maxSizeBytes) {
          errors.push(
            `File size exceeds limit: ${(metadata.size / 1024).toFixed(2)}KB > ${constraints.maxSize}KB`,
          );
        }
      }

      // Check aspect ratio
      if (constraints.aspectRatio) {
        const [expectedWidth, expectedHeight] = constraints.aspectRatio
          .split(':')
          .map(Number);
        const expectedRatio = expectedWidth / expectedHeight;
        const actualRatio = metadata.width / metadata.height;

        // Allow small tolerance (0.01)
        if (Math.abs(expectedRatio - actualRatio) > 0.01) {
          errors.push(
            `Aspect ratio mismatch: expected ${constraints.aspectRatio}, got ${actualRatio.toFixed(2)}`,
          );
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      this.logger.error(`Validation failed: ${error.message}`);
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
      };
    }
  }
}