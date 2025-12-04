// src/llm/llm.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
      model: "gemini-pro",
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
    "aspectRatio": "1:1"
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