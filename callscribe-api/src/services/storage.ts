import fs from 'fs';
import path from 'path';
import { Config } from '../config';

export class StorageService {
  private recordingsDir: string;

  constructor(config: Config) {
    this.recordingsDir = path.join(config.STORAGE_DIR, 'recordings');
    fs.mkdirSync(this.recordingsDir, { recursive: true });
  }

  getRecordingsDir(): string {
    return this.recordingsDir;
  }

  getFilePath(filename: string): string {
    return path.join(this.recordingsDir, filename);
  }

  async saveFile(filename: string, data: Buffer): Promise<{ path: string; size: number }> {
    const filePath = this.getFilePath(filename);
    await fs.promises.writeFile(filePath, data);
    return { path: filename, size: data.length };
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = this.getFilePath(filename);
    try {
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async fileExists(filename: string): Promise<boolean> {
    try {
      await fs.promises.access(this.getFilePath(filename));
      return true;
    } catch {
      return false;
    }
  }
}
