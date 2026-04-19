import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs';
import { Config } from '../config';
import { StorageService } from './storage';

export class TranscriptionService {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private storage: StorageService;

  constructor(config: Config, storage: StorageService) {
    this.anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    this.openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    this.storage = storage;
  }

  async speechToText(audioFilePath: string): Promise<string> {
    const fullPath = this.storage.getFilePath(audioFilePath);
    const file = fs.createReadStream(fullPath);

    const response = await this.openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'text',
    });

    return response as unknown as string;
  }

  async formatTranscript(
    rawTranscript: string,
    phoneNumber: string,
    direction: string,
    startedAt: Date,
    durationSeconds: number | null,
  ): Promise<string> {
    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `You are a call transcript processor. Below is a raw speech-to-text transcription of a phone call.

Phone number: ${phoneNumber}
Direction: ${direction}
Date: ${startedAt.toISOString()}
Duration: ${durationSeconds ? `${durationSeconds} seconds` : 'unknown'}

Raw transcript:
${rawTranscript}

Please:
1. Clean up the transcript for readability (fix obvious speech-to-text errors)
2. If possible, identify and label different speakers as "Caller" and "Recipient"
3. Add paragraph breaks at natural conversation points
4. Provide a brief summary (3-5 sentences) at the top
5. Note any action items or commitments mentioned

Format as:
## Summary
[summary]

## Action Items
[bullet list, or "None identified"]

## Transcript
[cleaned transcript]`,
        },
      ],
    });

    const block = message.content[0];
    return block.type === 'text' ? block.text : '';
  }

  async transcribe(
    audioFilePath: string,
    phoneNumber: string,
    direction: string,
    startedAt: Date,
    durationSeconds: number | null,
  ): Promise<string> {
    const rawTranscript = await this.speechToText(audioFilePath);
    const formatted = await this.formatTranscript(
      rawTranscript,
      phoneNumber,
      direction,
      startedAt,
      durationSeconds,
    );
    return formatted;
  }
}
