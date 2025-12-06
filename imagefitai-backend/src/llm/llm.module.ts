<<<<<<< HEAD
=======
// src/llm/llm.module.ts

>>>>>>> feature
import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';

@Module({
<<<<<<< HEAD
  providers: [LlmService]
})
export class LlmModule {}
=======
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
>>>>>>> feature
