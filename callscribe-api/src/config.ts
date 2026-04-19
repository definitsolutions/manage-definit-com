export interface Config {
  PORT: number;
  API_KEY: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  EMAIL_FROM: string;
  EMAIL_TO: string;
  STORAGE_DIR: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    PORT: parseInt(process.env.PORT || '3020', 10),
    API_KEY: requireEnv('API_KEY'),
    ANTHROPIC_API_KEY: requireEnv('ANTHROPIC_API_KEY'),
    OPENAI_API_KEY: requireEnv('OPENAI_API_KEY'),
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.office365.com',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_SECURE: process.env.SMTP_SECURE === 'true',
    SMTP_USER: requireEnv('SMTP_USER'),
    SMTP_PASS: requireEnv('SMTP_PASS'),
    EMAIL_FROM: process.env.EMAIL_FROM || 'callscribe@definit.com',
    EMAIL_TO: process.env.EMAIL_TO || 'r.mcnicholas@definit.com',
    STORAGE_DIR: process.env.STORAGE_DIR || '/app/storage',
  };
}
