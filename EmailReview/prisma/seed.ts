import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── App Settings ─────────────────────────────────────────
  const settings = [
    { key: 'sync_days', value: '7', category: 'thresholds', description: 'Number of days to look back when syncing mail' },
    { key: 'stale_hours', value: '48', category: 'thresholds', description: 'Hours of inactivity before a thread is flagged stale' },
    { key: 'unread_hours', value: '24', category: 'thresholds', description: 'Hours before an unread client email is flagged' },
    { key: 'urgency_keywords', value: JSON.stringify([
      'urgent', 'asap', 'outage', 'down', 'cannot access', 'can\'t access',
      'invoice', 'renewal', 'cancel', 'legal', 'emergency', 'critical',
      'immediately', 'deadline', 'overdue', 'escalate', 'breach', 'compromised'
    ]), category: 'keywords', description: 'Keywords that trigger urgency detection' },
    { key: 'commitment_phrases', value: JSON.stringify([
      'i\'ll get back to you', 'i will send', 'i\'ll send', 'i\'ll check',
      'i will confirm', 'let me follow up', 'i\'ll take care of it',
      'i\'ll look into', 'i will look into', 'i\'ll have an answer',
      'i\'ll update you', 'i will update', 'we\'ll get back',
      'i\'ll circle back', 'let me check', 'i\'ll reach out',
      'i\'ll schedule', 'i will schedule', 'by end of day', 'by eod',
      'i\'ll have this done', 'i will have this done'
    ]), category: 'keywords', description: 'Phrases indicating a commitment was made' },
    { key: 'digest_time', value: '07:00', category: 'digest', description: 'Time of day to generate the daily digest (HH:MM)' },
    { key: 'digest_top_n', value: '10', category: 'digest', description: 'Number of top items to include in the digest' },
  ];

  for (const s of settings) {
    await prisma.appSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, category: s.category, description: s.description },
      create: s,
    });
  }

  // ── Client Domains ───────────────────────────────────────
  const clientDomains = [
    { domain: 'acmecorp.com', companyName: 'Acme Corporation' },
    { domain: 'globexinc.com', companyName: 'Globex Inc.' },
    { domain: 'initech.com', companyName: 'Initech' },
    { domain: 'umbrellacorp.net', companyName: 'Umbrella Corp' },
    { domain: 'wayneenterprises.com', companyName: 'Wayne Enterprises' },
    { domain: 'starkindustries.com', companyName: 'Stark Industries' },
  ];

  for (const d of clientDomains) {
    await prisma.clientDomain.upsert({
      where: { domain: d.domain },
      update: { companyName: d.companyName },
      create: d,
    });
  }

  // ── VIP Contacts ─────────────────────────────────────────
  const vips = [
    { email: 'ceo@acmecorp.com', name: 'John Acme', companyName: 'Acme Corporation', priority: 3 },
    { email: 'cfo@globexinc.com', name: 'Hank Scorpio', companyName: 'Globex Inc.', priority: 2 },
    { email: 'bill@initech.com', name: 'Bill Lumbergh', companyName: 'Initech', priority: 2 },
  ];

  for (const v of vips) {
    await prisma.vipContact.upsert({
      where: { email: v.email },
      update: { name: v.name, companyName: v.companyName, priority: v.priority },
      create: v,
    });
  }

  // ── Ignored Domains ──────────────────────────────────────
  const ignored = [
    { domain: 'noreply.microsoft.com', reason: 'Microsoft system notifications' },
    { domain: 'notifications.github.com', reason: 'GitHub notifications' },
    { domain: 'mailer-daemon.googlemail.com', reason: 'Bounce notifications' },
    { domain: 'linkedin.com', reason: 'LinkedIn notifications' },
    { domain: 'marketing.salesforce.com', reason: 'Salesforce marketing' },
    { domain: 'calendar-notification.google.com', reason: 'Google Calendar' },
  ];

  for (const i of ignored) {
    await prisma.ignoredDomain.upsert({
      where: { domain: i.domain },
      update: { reason: i.reason },
      create: i,
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
