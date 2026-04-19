import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding recurring tasks database...');

  // 1. System user for scheduler
  const systemUser = await prisma.user.upsert({
    where: { portalUserId: 'system' },
    update: {},
    create: {
      portalUserId: 'system',
      email: 'system@recurring-tasks.internal',
      displayName: 'System',
    },
  });
  console.log('  Created system user');

  // 2. Sample users (6 total, 2 per department)
  const users = await Promise.all([
    prisma.user.upsert({
      where: { portalUserId: 'seed-alice' },
      update: {},
      create: { portalUserId: 'seed-alice', email: 'alice@definit.com', displayName: 'Alice Johnson' },
    }),
    prisma.user.upsert({
      where: { portalUserId: 'seed-bob' },
      update: {},
      create: { portalUserId: 'seed-bob', email: 'bob@definit.com', displayName: 'Bob Smith' },
    }),
    prisma.user.upsert({
      where: { portalUserId: 'seed-carol' },
      update: {},
      create: { portalUserId: 'seed-carol', email: 'carol@definit.com', displayName: 'Carol Davis' },
    }),
    prisma.user.upsert({
      where: { portalUserId: 'seed-dave' },
      update: {},
      create: { portalUserId: 'seed-dave', email: 'dave@definit.com', displayName: 'Dave Wilson' },
    }),
    prisma.user.upsert({
      where: { portalUserId: 'seed-eve' },
      update: {},
      create: { portalUserId: 'seed-eve', email: 'eve@definit.com', displayName: 'Eve Martinez' },
    }),
    prisma.user.upsert({
      where: { portalUserId: 'seed-frank' },
      update: {},
      create: { portalUserId: 'seed-frank', email: 'frank@definit.com', displayName: 'Frank Brown' },
    }),
  ]);
  const [alice, bob, carol, dave, eve, frank] = users;
  console.log(`  Created ${users.length} users`);

  // 3. Departments
  const accounting = await prisma.department.upsert({
    where: { name: 'Accounting' },
    update: {},
    create: { name: 'Accounting' },
  });
  const operations = await prisma.department.upsert({
    where: { name: 'Operations' },
    update: {},
    create: { name: 'Operations' },
  });
  const it = await prisma.department.upsert({
    where: { name: 'IT' },
    update: {},
    create: { name: 'IT' },
  });
  console.log('  Created 3 departments');

  // 4. Department memberships
  const memberships = [
    { userId: alice.id, departmentId: accounting.id, role: 'manager' as const },
    { userId: bob.id, departmentId: accounting.id, role: 'member' as const },
    { userId: carol.id, departmentId: operations.id, role: 'manager' as const },
    { userId: dave.id, departmentId: operations.id, role: 'member' as const },
    { userId: eve.id, departmentId: it.id, role: 'manager' as const },
    { userId: frank.id, departmentId: it.id, role: 'member' as const },
  ];

  for (const m of memberships) {
    await prisma.departmentMembership.upsert({
      where: { userId_departmentId: { userId: m.userId, departmentId: m.departmentId } },
      update: { role: m.role },
      create: m,
    });
  }
  console.log('  Created 6 department memberships');

  // 5. Task Templates (6 total, 2 per department)
  const templates = [
    // Accounting
    {
      departmentId: accounting.id,
      title: 'Monthly Financial Close',
      description: 'Complete month-end financial close procedures including reconciliations and journal entries.',
      cadence: 'monthly' as const,
      recurrenceRule: { dayOfMonth: 5, businessDayAdjust: 'previous' },
      defaultOwnerId: alice.id,
      defaultBackupOwnerId: bob.id,
      proofRequired: true,
      sopUrl: 'https://docs.definit.com/sop/financial-close',
      createdById: alice.id,
      updatedById: alice.id,
    },
    {
      departmentId: accounting.id,
      title: 'Quarterly Tax Filing Prep',
      description: 'Prepare quarterly tax filing documents and review with CPA.',
      cadence: 'quarterly' as const,
      recurrenceRule: { lastBusinessDay: true },
      defaultOwnerId: bob.id,
      defaultBackupOwnerId: alice.id,
      proofRequired: false,
      sopUrl: null,
      createdById: alice.id,
      updatedById: alice.id,
    },
    // Operations
    {
      departmentId: operations.id,
      title: 'Weekly Standup Notes',
      description: 'Document weekly standup meeting notes and action items.',
      cadence: 'weekly' as const,
      recurrenceRule: { weekday: 0 }, // Monday
      defaultOwnerId: carol.id,
      defaultBackupOwnerId: dave.id,
      proofRequired: false,
      sopUrl: null,
      createdById: carol.id,
      updatedById: carol.id,
    },
    {
      departmentId: operations.id,
      title: 'Monthly Safety Inspection',
      description: 'Conduct monthly safety walkthrough and document findings with photos.',
      cadence: 'monthly' as const,
      recurrenceRule: { dayOfMonth: 15, businessDayAdjust: 'previous' },
      defaultOwnerId: dave.id,
      defaultBackupOwnerId: carol.id,
      proofRequired: true,
      sopUrl: 'https://docs.definit.com/sop/safety-inspection',
      createdById: carol.id,
      updatedById: carol.id,
    },
    // IT
    {
      departmentId: it.id,
      title: 'Weekly Patch Review',
      description: 'Review and approve pending Windows and application patches for deployment.',
      cadence: 'weekly' as const,
      recurrenceRule: { weekday: 4 }, // Friday
      defaultOwnerId: eve.id,
      defaultBackupOwnerId: frank.id,
      proofRequired: false,
      sopUrl: null,
      createdById: eve.id,
      updatedById: eve.id,
    },
    {
      departmentId: it.id,
      title: 'Annual License Audit',
      description: 'Audit all software licenses for compliance and renewal status.',
      cadence: 'annual' as const,
      recurrenceRule: { month: 1, day: 15 },
      defaultOwnerId: frank.id,
      defaultBackupOwnerId: eve.id,
      proofRequired: true,
      sopUrl: 'https://docs.definit.com/sop/license-audit',
      createdById: eve.id,
      updatedById: eve.id,
    },
  ];

  for (const t of templates) {
    await prisma.taskTemplate.upsert({
      where: {
        id: `seed-${t.title.toLowerCase().replace(/\s+/g, '-')}`,
      },
      update: {},
      create: {
        id: `seed-${t.title.toLowerCase().replace(/\s+/g, '-')}`,
        ...t,
      },
    });
  }
  console.log('  Created 6 task templates');

  console.log('Seed complete!');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
