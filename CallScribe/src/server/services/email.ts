import nodemailer from 'nodemailer';
import { marked } from 'marked';
import { config } from '../config.js';

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpSecure,
  auth: { user: config.smtpUser, pass: config.smtpPass },
});

export async function sendTranscriptEmail(
  phoneNumber: string,
  direction: string,
  startedAt: Date,
  transcript: string,
): Promise<void> {
  const dateStr = startedAt.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const subject = `Call Transcript: ${phoneNumber} (${direction}) — ${dateStr}`;
  const html = await marked(transcript);

  await transporter.sendMail({
    from: config.emailFrom,
    to: config.emailTo,
    subject,
    text: transcript,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:20px;">
      <div style="border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:20px;">
        <h1 style="margin:0;font-size:18px;color:#1e40af;">CallScribe Transcript</h1>
        <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">${phoneNumber} &middot; ${direction} &middot; ${dateStr}</p>
      </div>
      ${html}
    </div>`,
  });
}
