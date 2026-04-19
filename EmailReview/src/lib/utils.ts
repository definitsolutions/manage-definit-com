import { formatDistanceToNow, differenceInHours, differenceInMinutes } from 'date-fns';

/** Extract the domain from an email address. */
export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

/** Human-readable relative time: "3 hours ago", "2 days ago". */
export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** Hours since a given date. */
export function hoursSince(date: Date | string): number {
  return differenceInHours(new Date(), new Date(date));
}

/** Minutes since a given date. */
export function minutesSince(date: Date | string): number {
  return differenceInMinutes(new Date(), new Date(date));
}

/** Truncate text to a max length with ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

/** Normalize an email to lowercase trimmed form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Check if a string contains any of the given keywords (case-insensitive). */
export function containsAny(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

/** Standard JSON response helper. */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Error response helper. */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

/** Safely serialize an object for Prisma Json fields. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJson(val: any): any {
  return JSON.parse(JSON.stringify(val));
}

/** Severity label from a numeric priority score (0-100). */
export function severityFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}
