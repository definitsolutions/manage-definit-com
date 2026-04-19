import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/server/lib/db.js', () => ({
  prisma: {
    taskTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    taskInstance: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../src/server/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { prisma } from '../src/server/lib/db.js';
import { TaskGenerationService } from '../src/server/services/task-generation.js';

const svc = new TaskGenerationService();
const mockPrisma = prisma as any;

const baseTemplate = {
  id: 't1',
  departmentId: 'd1',
  title: 'Monthly Close',
  description: 'Close the books',
  cadence: 'monthly',
  recurrenceRule: { dayOfMonth: 5 },
  defaultOwnerId: 'u1',
  defaultBackupOwnerId: null,
  proofRequired: true,
  sopUrl: null,
  active: true,
  createdById: 'u1',
  updatedById: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TaskGenerationService', () => {
  describe('generateForTemplate', () => {
    it('creates task instances for due dates', async () => {
      mockPrisma.taskTemplate.findUnique.mockResolvedValue(baseTemplate);
      mockPrisma.taskInstance.create.mockResolvedValue({ id: 'task1' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const now = new Date(2026, 0, 1);
      const end = new Date(2026, 2, 31);
      const result = await svc.generateForTemplate('t1', 'u1', now, end);

      // Monthly on 5th for Jan, Feb, Mar = 3 instances
      expect(result.created).toBe(3);
      expect(result.skipped).toBe(0);
      expect(mockPrisma.taskInstance.create).toHaveBeenCalledTimes(3);
    });

    it('skips duplicates via P2002 unique constraint violation', async () => {
      mockPrisma.taskTemplate.findUnique.mockResolvedValue(baseTemplate);
      mockPrisma.taskInstance.create
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce({ id: 'task2' })
        .mockResolvedValueOnce({ id: 'task3' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const now = new Date(2026, 0, 1);
      const end = new Date(2026, 2, 31);
      const result = await svc.generateForTemplate('t1', 'u1', now, end);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(1);
    });

    it('skips inactive templates', async () => {
      mockPrisma.taskTemplate.findUnique.mockResolvedValue({ ...baseTemplate, active: false });

      const result = await svc.generateForTemplate('t1', 'u1');
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('returns zeros for non-existent template', async () => {
      mockPrisma.taskTemplate.findUnique.mockResolvedValue(null);

      const result = await svc.generateForTemplate('nonexistent', 'u1');
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe('generateAll', () => {
    it('generates for all active templates', async () => {
      mockPrisma.taskTemplate.findMany.mockResolvedValue([baseTemplate, { ...baseTemplate, id: 't2' }]);
      mockPrisma.taskTemplate.findUnique.mockResolvedValue(baseTemplate);
      mockPrisma.taskInstance.create.mockResolvedValue({ id: 'task1' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await svc.generateAll('system-user');
      expect(result.created).toBeGreaterThan(0);
    });
  });
});
