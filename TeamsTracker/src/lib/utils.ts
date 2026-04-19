import { formatDistanceToNow, differenceInHours } from 'date-fns';

export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function hoursSince(date: Date | string): number {
  return differenceInHours(new Date(), new Date(date));
}

export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJson(val: any): any {
  return JSON.parse(JSON.stringify(val));
}

/** Strip HTML tags and decode entities for plain text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
