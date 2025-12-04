// src/llm/llm.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ImageMetadata } from '../ffmpeg/ffmpeg.service';

export interface LLMResponse {
  constraints: {
    format?: string;
    width?: number;
    height?: number;
    maxSize?: number;
    aspectRatio?: string;
  };
  commands: string[];
  finalOutput: string;
  summary: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly useAI: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.useAI = true;
      this.logger.log('🤖 LLM Service initialized with Google Gemini (FREE)');
    } else {
      this.useAI = false;
      this.logger.warn('⚠️  No GOOGLE_API_KEY found, using rule-based parser');
    }
  }

  async generateCommands(
    rulesText: string,
    metadata: ImageMetadata,
    inputFileName: string,
  ): Promise<LLMResponse> {
    if (!this.useAI) {
      this.logger.log('Using rule-based parser (no AI)');
      return this.parseRulesAndGenerateCommands(rulesText, metadata, inputFileName);
    }

    try {
      this.logger.log('🚀 Calling Google Gemini AI...');
      const response = await this.callGemini(rulesText, metadata, inputFileName);
      this.logger.log(`✅ AI generated ${response.commands.length} command(s)`);
      return response;
    } catch (error) {
      this.logger.error(`❌ AI call failed: ${error.message}`);
      this.logger.log('Falling back to rule-based parser');
      return this.parseRulesAndGenerateCommands(rulesText, metadata, inputFileName);
    }
  }

private async callGemini(
  rulesText: string,
  metadata: ImageMetadata,
  inputFileName: string,
): Promise<LLMResponse> {
  const model = this.genAI.getGenerativeModel({ 
    model: "gemini-2.5-pro",
    generationConfig: {
      temperature: 0.2, // ← Slightly higher for more creativity
      responseMimeType: "application/json",
    }
  });

  const prompt = `You are an expert image processing specialist with deep knowledge of ffmpeg and image optimization for various use cases.

CURRENT IMAGE METADATA:
- Filename: ${inputFileName}
- Width: ${metadata.width}px
- Height: ${metadata.height}px
- Format: ${metadata.format}
- Current Size: ${(metadata.size / 1024).toFixed(2)} KB

USER REQUIREMENTS:
${rulesText}

YOUR TASK:
Analyze the user's requirements and generate appropriate ffmpeg commands. Use your knowledge to:

1. **Interpret vague requests**: If user says "for social media", "for web", "for printing", etc., apply best practices for that use case
2. **Make intelligent defaults**: If dimensions aren't specified, choose appropriate ones based on context
3. **Balance quality and size**: Understand the tradeoff between file size and image quality
4. **Platform knowledge**: Know typical requirements for Instagram, LinkedIn, passport photos, government IDs, etc.

COMMON USE CASES & YOUR EXPERTISE:
- **Social Media**: Square format (1080x1080 or 600x600), JPEG, <1MB
- **Passport/ID Photos**: 600x600 or 400x400, square, JPEG, high quality
- **Website Thumbnails**: 300x300 or 400x400, JPEG, <100KB
- **Email-Friendly**: Reduce to 800px max dimension, JPEG, <200KB
- **Professional/LinkedIn**: Square or 16:9, JPEG, moderate size
- **Printing**: Maintain high resolution, less compression, PNG or high-quality JPEG
- **Mobile**: Optimize for smaller screens, 800px max, JPEG

FFMPEG COMMAND RULES:
1. Start with: "ffmpeg -i ${inputFileName}"
2. Use -vf for filters: scale, pad, crop
3. For JPEG: "-c:v mjpeg -q:v N" (2-15, lower=better)
4. For PNG: "-c:v png"
5. For square with padding: scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:(ow-iw)/2:(oh-ih)/2
6. Output: "output.[extension]"


RESPOND WITH THIS JSON:
{
  "constraints": {
    "format": "jpeg",
    "width": 600,
    "height": 600,
    "maxSize": 200,
    "aspectRatio": "1:1"
  },
  "commands": [
    "ffmpeg -i ${inputFileName} -vf \\"scale=600:600:force_original_aspect_ratio=decrease,pad=600:600:(ow-iw)/2:(oh-ih)/2\\" -c:v mjpeg -q:v 8 output.jpg"
  ],
  "finalOutput": "output.jpg",
  "summary": "A clear explanation of what you did and why, based on the user's requirements"
}

IIMPORTANT:
- Be intelligent and contextual
- Only include constraints that are relevant
- Generate working ffmpeg commands
- Explain your decisions in the summary
- Return ONLY valid JSON`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  this.logger.debug(`Raw AI response: ${responseText.substring(0, 200)}...`);
  
  const response = JSON.parse(responseText);
  return response;
}


  // Fallback: Rule-based parser (same as before)
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

    // Parse size requirement
    const sizeMatch = rules.match(/(?:max|under|less than|below)\s+(\d+)\s*kb/i);
    if (sizeMatch) {
      constraints.maxSize = parseInt(sizeMatch[1]);
    }

    // Parse dimension requirements
    const dimensionMatch = rules.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (dimensionMatch) {
      constraints.width = parseInt(dimensionMatch[1]);
      constraints.height = parseInt(dimensionMatch[2]);
    }

    // Parse aspect ratio
    const aspectMatch = rules.match(/(?:aspect ratio|ratio)\s+(\d+):(\d+)/i);
    if (aspectMatch) {
      constraints.aspectRatio = `${aspectMatch[1]}:${aspectMatch[2]}`;
    }

    // Build ffmpeg command
    let command = `ffmpeg -i ${inputFileName}`;
    const filters: string[] = [];

    if (constraints.width && constraints.height) {
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

    if (filters.length > 0) {
      command += ` -vf "${filters.join(',')}"`;
    }

    if (constraints.format === 'jpeg') {
      command += ' -c:v mjpeg';
      if (constraints.maxSize) {
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

    const summary = this.generateSummary(metadata, constraints, outputFileName);

    return {
      constraints,
      commands,
      finalOutput: outputFileName,
      summary,
    };
  }

  private calculateJpegQuality(targetSizeKB: number): number {
    if (targetSizeKB < 50) return 15;
    if (targetSizeKB < 100) return 10;
    if (targetSizeKB < 200) return 7;
    if (targetSizeKB < 500) return 5;
    return 3;
  }

  private generateSummary(
    originalMetadata: ImageMetadata,
    constraints: any,
    outputFileName: string,
  ): string {
    const parts: string[] = [];

    if (constraints.format) {
      parts.push(`Converted to ${constraints.format.toUpperCase()}`);
    }

    if (constraints.width && constraints.height) {
      parts.push(
        `Resized from ${originalMetadata.width}x${originalMetadata.height} to ${constraints.width}x${constraints.height}`,
      );
    }

    if (constraints.maxSize) {
      parts.push(`Compressed to meet ${constraints.maxSize}KB size limit`);
    }

    if (constraints.aspectRatio) {
      parts.push(`Adjusted to ${constraints.aspectRatio} aspect ratio`);
    }

    return parts.join(', ') + '.';
  }
}