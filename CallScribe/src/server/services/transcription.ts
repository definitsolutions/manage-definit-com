import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { config } from '../config.js';
import { getFilePath } from './storage.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
const openai = new OpenAI({ apiKey: config.openaiApiKey });

const WHISPER_MAX_SIZE = 24 * 1024 * 1024; // 24MB (leave margin under 25MB limit)

function compressToMp3(wavPath: string): string {
  const mp3Path = wavPath.replace(/\.wav$/, '.mp3');
  // ffmpeg: convert WAV to MP3 at 64kbps mono (plenty for speech)
  execSync(`ffmpeg -y -i "${wavPath}" -ac 1 -ab 64k -ar 16000 "${mp3Path}"`, {
    timeout: 120000,
    stdio: 'pipe',
  });
  return mp3Path;
}

export async function speechToText(audioFilePath: string): Promise<string> {
  const fullPath = getFilePath(audioFilePath);
  const stats = fs.statSync(fullPath);

  let fileToSend = fullPath;
  let tempMp3: string | null = null;

  // Compress if over Whisper's size limit
  if (stats.size > WHISPER_MAX_SIZE) {
    console.log(`Audio file ${stats.size} bytes exceeds limit, compressing to MP3...`);
    tempMp3 = compressToMp3(fullPath);
    fileToSend = tempMp3;
    const mp3Stats = fs.statSync(tempMp3);
    console.log(`Compressed to ${mp3Stats.size} bytes`);
  }

  try {
    const file = fs.createReadStream(fileToSend);
    const response = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'text',
    });
    return response as unknown as string;
  } finally {
    // Clean up temp MP3
    if (tempMp3 && fs.existsSync(tempMp3)) {
      fs.unlinkSync(tempMp3);
    }
  }
}

export async function formatTranscript(
  rawTranscript: string,
  phoneNumber: string,
  direction: string,
  startedAt: Date,
  durationSeconds: number | null,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `You are a call transcript processor. Below is a raw speech-to-text transcription of a phone call. Note: the recording may only capture one side of the conversation (the device owner's voice). Infer context where possible.

Phone number: ${phoneNumber}
Direction: ${direction}
Date: ${startedAt.toISOString()}
Duration: ${durationSeconds ? `${durationSeconds} seconds` : 'unknown'}

Raw transcript:
${rawTranscript}

Please:
1. Clean up the transcript for readability (fix obvious speech-to-text errors)
2. If you can identify different speakers, label them as "Caller" and "Recipient"
3. Add paragraph breaks at natural conversation points
4. Provide a brief summary (3-5 sentences) at the top
5. Note any action items, commitments, or follow-ups mentioned

Format as:
## Summary
[summary]

## Action Items
[bullet list, or "None identified"]

## Transcript
[cleaned transcript]`,
    }],
  });
  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

export async function transcribe(
  audioFilePath: string,
  phoneNumber: string,
  direction: string,
  startedAt: Date,
  durationSeconds: number | null,
): Promise<string> {
  const raw = await speechToText(audioFilePath);
  return formatTranscript(raw, phoneNumber, direction, startedAt, durationSeconds);
}
