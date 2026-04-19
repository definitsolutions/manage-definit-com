import nodemailer from 'nodemailer';
import { marked } from 'marked';
import { Config } from '../config';

export class EmailService {
  private transporter: nodemailer.Transporter;
  private from: string;
  private to: string;

  constructor(config: Config) {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
    this.from = config.EMAIL_FROM;
    this.to = config.EMAIL_TO;
  }

  async sendTranscript(
    phoneNumber: string,
    direction: string,
    startedAt: Date,
    transcript: string,
  ): Promise<void> {
    const dateStr = startedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = `Call Transcript: ${phoneNumber} (${direction}) — ${dateStr}`;
    const html = await marked(transcript);

    await this.transporter.sendMail({
      from: this.from,
      to: this.to,
      subject,
      text: transcript,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 18px; color: #1e40af;">CallScribe Transcript</h1>
            <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">
              ${phoneNumber} &middot; ${direction} &middot; ${dateStr}
            </p>
          </div>
          ${html}
        </div>
      `,
    });
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
