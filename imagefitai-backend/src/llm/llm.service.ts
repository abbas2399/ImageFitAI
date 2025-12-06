// src/llm/llm.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { ImageMetadata } from '../ffmpeg/ffmpeg.service';

export interface LLMResponse {
  constraints: {
    format?: string;
    width?: number;
    height?: number;

    maxSize?: number; // in KB

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


  constructor(private configService: ConfigService) {}

  /**
   * Generate ffmpeg commands based on requirements and image metadata
   */

  private readonly genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is required! Please add it to your .env file');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger.log('🤖 LLM Service initialized with Google Gemini AI');
  }


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

    this.logger.log('🚀 Calling Google Gemini AI...');
    this.logger.log(`User Requirements: ${rulesText}`);
    
    try {
      const response = await this.callGemini(rulesText, metadata, inputFileName);
      this.logger.log(`✅ AI successfully generated ${response.commands.length} command(s)`);
      return response;
    } catch (error) {
      this.logger.error(`❌ AI call failed: ${error.message}`);
      this.logger.error(error.stack);
      
      // Provide user-friendly error message
      const userMessage = this.getUserFriendlyErrorMessage(error);
      
      throw new BadRequestException(userMessage);
    }
  }

  private getUserFriendlyErrorMessage(error: any): string {
    const errorMsg = error.message.toLowerCase();
    
    // API key issues
    if (errorMsg.includes('api key') || errorMsg.includes('authentication') || errorMsg.includes('401')) {
      return '🔑 AI service authentication failed. Please contact support - our API key may need to be updated.';
    }
    
    // Model not found
    if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('model')) {
      return '🤖 AI model is temporarily unavailable. Please try again in a few moments. If the problem persists, contact support.';
    }
    
    // Rate limit
    if (errorMsg.includes('rate limit') || errorMsg.includes('quota') || errorMsg.includes('429')) {
      return '⏱️ Too many requests at the moment. Please wait a minute and try again.';
    }
    
    // Network/timeout issues
    if (errorMsg.includes('timeout') || errorMsg.includes('network') || errorMsg.includes('econnrefused')) {
      return '🌐 Cannot connect to AI service. Please check your internet connection and try again.';
    }
    
    // Invalid response from AI
    if (errorMsg.includes('json') || errorMsg.includes('parse')) {
      return '📝 AI generated an invalid response. Please try rephrasing your requirements in a simpler way.';
    }
    
    // Generic error with more details
    return `❌ AI processing failed: ${error.message}. Please try again or contact support if the problem persists.`;
  }

  private async callGemini(
    rulesText: string,
    metadata: ImageMetadata,
    inputFileName: string,
  ): Promise<LLMResponse> {
    
    const model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.2,
      }
    });

    const prompt = this.buildPrompt(rulesText, metadata, inputFileName);

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      this.logger.debug(`Raw AI response: ${responseText.substring(0, 200)}...`);
      
      const parsedResponse = this.parseAIResponse(responseText);
      this.validateResponse(parsedResponse);
      
      return parsedResponse;
      
    } catch (error) {
      this.logger.error(`Gemini API error: ${error.message}`);
      throw error;
    }
  }

  private buildPrompt(
    rulesText: string,
    metadata: ImageMetadata,
    inputFileName: string,
  ): string {
    return `You are an expert image processing specialist with deep knowledge of ffmpeg and image optimization.

CURRENT IMAGE METADATA:
- Filename: ${inputFileName}
- Width: ${metadata.width}px
- Height: ${metadata.height}px
- Format: ${metadata.format}
- Current Size: ${(metadata.size / 1024).toFixed(2)} KB

USER REQUIREMENTS:
${rulesText}

YOUR TASK:
Analyze the user's requirements and generate appropriate ffmpeg commands. Use your expertise to:

1. **Interpret vague requests**: If user says "for social media", "for web", "for printing", apply best practices
2. **Make intelligent defaults**: Choose appropriate dimensions based on context
3. **Balance quality and size**: Optimize the tradeoff between file size and image quality
4. **Platform knowledge**: Know requirements for Instagram, LinkedIn, passport photos, government IDs, etc.

COMMON USE CASES:
- **Social Media (Instagram/Facebook)**: 1080x1080 or 600x600, JPEG, <1MB
- **Passport/ID Photos**: 600x600, square, JPEG, high quality
- **Website Thumbnails**: 400x400, JPEG, <100KB
- **Email-Friendly**: Max 800px, JPEG, <200KB
- **Professional (LinkedIn)**: Square or 16:9, JPEG, moderate size
- **Printing**: High resolution, minimal compression, PNG or high-quality JPEG
- **Mobile Optimized**: Max 800px, JPEG, optimized compression

FFMPEG COMMAND RULES:
1. Always start with: "ffmpeg -i ${inputFileName}"
2. Use -vf for video filters: scale, pad, crop
3. For JPEG output: "-c:v mjpeg -q:v N" where N is 2-15 (lower = better quality)
4. For PNG output: "-c:v png"
5. For square images with padding: "scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:(ow-iw)/2:(oh-ih)/2"
6. Output filename: "output.[extension]"

RESPOND WITH VALID JSON ONLY (no markdown, no code blocks):
{
  "constraints": {
    "format": "jpeg",
    "width": 600,
    "height": 600,
    "maxSize": 200,
    "aspectRatio": "1:1",
    "backgroundColor": "white"
  },
  "commands": [
    "ffmpeg -i ${inputFileName} -vf \\"scale=600:600:force_original_aspect_ratio=decrease,pad=600:600:(ow-iw)/2:(oh-ih)/2\\" -c:v mjpeg -q:v 8 output.jpg"
  ],
  "finalOutput": "output.jpg",
  "summary": "Clear explanation of transformations applied"
}

CRITICAL:
- Only include constraint fields that are mentioned or implied
- Generate working ffmpeg commands
- Ensure commands are safe
- Provide clear summary
- Return ONLY JSON`;
  }

  private parseAIResponse(responseText: string): LLMResponse {
    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/```json\n?/g, '');
    cleanText = cleanText.replace(/```\n?/g, '');
    cleanText = cleanText.trim();
    
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response does not contain valid JSON');
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
    }
  }

  private validateResponse(response: any): void {
    if (!response.commands || !Array.isArray(response.commands) || response.commands.length === 0) {
      throw new Error('AI response missing valid commands');
    }

    if (!response.finalOutput || typeof response.finalOutput !== 'string') {
      throw new Error('AI response missing valid output filename');
    }

    if (!response.summary || typeof response.summary !== 'string') {
      throw new Error('AI response missing valid summary');
    }

    for (const command of response.commands) {
      if (!command.startsWith('ffmpeg -i')) {
        throw new Error(`Invalid ffmpeg command generated`);
      }
    }

    this.logger.log('✓ AI response validation passed');

  }
}