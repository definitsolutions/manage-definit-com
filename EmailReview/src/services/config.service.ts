import prisma from '@/lib/prisma';
import type { AppConfig } from '@/types';

/**
 * ConfigService reads and writes app-level configuration from the database.
 * Settings are stored as key-value pairs and parsed into typed structures.
 */
export class ConfigService {
  /** Load all config into a typed structure. */
  async getConfig(): Promise<AppConfig> {
    const rows = await prisma.appSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      syncDays: parseInt(map.get('sync_days') ?? '7', 10),
      staleHours: parseInt(map.get('stale_hours') ?? '48', 10),
      unreadHours: parseInt(map.get('unread_hours') ?? '24', 10),
      urgencyKeywords: parseJsonArray(map.get('urgency_keywords'), [
        'urgent', 'asap', 'outage', 'down', 'cannot access',
      ]),
      commitmentPhrases: parseJsonArray(map.get('commitment_phrases'), [
        "i'll get back to you", "i will send", "let me follow up",
      ]),
      digestTime: map.get('digest_time') ?? '07:00',
      digestTopN: parseInt(map.get('digest_top_n') ?? '10', 10),
    };
  }

  /** Update a single setting. */
  async setSetting(key: string, value: string, category?: string): Promise<void> {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, category: category ?? 'general' },
    });
  }

  /** Bulk update config from the typed structure. */
  async updateConfig(config: Partial<AppConfig>): Promise<void> {
    const updates: Array<{ key: string; value: string; category: string }> = [];

    if (config.syncDays !== undefined)
      updates.push({ key: 'sync_days', value: String(config.syncDays), category: 'thresholds' });
    if (config.staleHours !== undefined)
      updates.push({ key: 'stale_hours', value: String(config.staleHours), category: 'thresholds' });
    if (config.unreadHours !== undefined)
      updates.push({ key: 'unread_hours', value: String(config.unreadHours), category: 'thresholds' });
    if (config.urgencyKeywords !== undefined)
      updates.push({ key: 'urgency_keywords', value: JSON.stringify(config.urgencyKeywords), category: 'keywords' });
    if (config.commitmentPhrases !== undefined)
      updates.push({ key: 'commitment_phrases', value: JSON.stringify(config.commitmentPhrases), category: 'keywords' });
    if (config.digestTime !== undefined)
      updates.push({ key: 'digest_time', value: config.digestTime, category: 'digest' });
    if (config.digestTopN !== undefined)
      updates.push({ key: 'digest_top_n', value: String(config.digestTopN), category: 'digest' });

    for (const u of updates) {
      await prisma.appSetting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value, category: u.category },
      });
    }
  }

  // ── Client domain management ─────────────────────────────

  async getClientDomains() {
    return prisma.clientDomain.findMany({ where: { isActive: true }, orderBy: { domain: 'asc' } });
  }

  async addClientDomain(domain: string, companyName?: string) {
    return prisma.clientDomain.upsert({
      where: { domain: domain.toLowerCase() },
      update: { companyName, isActive: true },
      create: { domain: domain.toLowerCase(), companyName },
    });
  }

  async removeClientDomain(id: string) {
    return prisma.clientDomain.update({ where: { id }, data: { isActive: false } });
  }

  // ── VIP contact management ───────────────────────────────

  async getVipContacts() {
    return prisma.vipContact.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } });
  }

  async addVipContact(email: string, name?: string, companyName?: string, priority?: number) {
    return prisma.vipContact.upsert({
      where: { email: email.toLowerCase() },
      update: { name, companyName, priority: priority ?? 1, isActive: true },
      create: { email: email.toLowerCase(), name, companyName, priority: priority ?? 1 },
    });
  }

  async removeVipContact(id: string) {
    return prisma.vipContact.update({ where: { id }, data: { isActive: false } });
  }

  // ── Ignored domain management ────────────────────────────

  async getIgnoredDomains() {
    return prisma.ignoredDomain.findMany({ orderBy: { domain: 'asc' } });
  }

  async addIgnoredDomain(domain: string, reason?: string) {
    return prisma.ignoredDomain.upsert({
      where: { domain: domain.toLowerCase() },
      update: { reason },
      create: { domain: domain.toLowerCase(), reason },
    });
  }

  async removeIgnoredDomain(id: string) {
    return prisma.ignoredDomain.delete({ where: { id } });
  }
}

function parseJsonArray(val: string | undefined, fallback: string[]): string[] {
  if (!val) return fallback;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export const configService = new ConfigService();
