import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('../src/server/lib/db.js', () => ({
  prisma: {
    departmentMembership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../src/server/lib/db.js';
import { AuthorizationService } from '../src/server/services/authorization.js';

const svc = new AuthorizationService();
const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthorizationService', () => {
  describe('getMembership', () => {
    it('returns membership when it exists', async () => {
      const membership = { id: '1', userId: 'u1', departmentId: 'd1', role: 'member' };
      mockPrisma.departmentMembership.findUnique.mockResolvedValue(membership);

      const result = await svc.getMembership('u1', 'd1');
      expect(result).toEqual(membership);
    });

    it('returns null when not a member', async () => {
      mockPrisma.departmentMembership.findUnique.mockResolvedValue(null);

      const result = await svc.getMembership('u1', 'd1');
      expect(result).toBeNull();
    });
  });

  describe('assertMember', () => {
    it('returns membership for valid member', async () => {
      const membership = { id: '1', userId: 'u1', departmentId: 'd1', role: 'member' };
      mockPrisma.departmentMembership.findUnique.mockResolvedValue(membership);

      const result = await svc.assertMember('u1', 'd1');
      expect(result).toEqual(membership);
    });

    it('throws 403 when not a member', async () => {
      mockPrisma.departmentMembership.findUnique.mockResolvedValue(null);

      await expect(svc.assertMember('u1', 'd1')).rejects.toThrow('Not a member of this department');
    });
  });

  describe('assertManagerOrAdmin', () => {
    it('allows manager', async () => {
      const membership = { id: '1', userId: 'u1', departmentId: 'd1', role: 'manager' };
      mockPrisma.departmentMembership.findUnique.mockResolvedValue(membership);

      const result = await svc.assertManagerOrAdmin('u1', 'd1');
      expect(result.role).toBe('manager');
    });

    it('allows admin', async () => {
      const membership = { id: '1', userId: 'u1', departmentId: 'd1', role: 'admin' };
      mockPrisma.departmentMembership.findUnique.mockResolvedValue(membership);

      const result = await svc.assertManagerOrAdmin('u1', 'd1');
      expect(result.role).toBe('admin');
    });

    it('rejects member role', async () => {
      const membership = { id: '1', userId: 'u1', departmentId: 'd1', role: 'member' };
      mockPrisma.departmentMembership.findUnique.mockResolvedValue(membership);

      await expect(svc.assertManagerOrAdmin('u1', 'd1')).rejects.toThrow('Manager or admin role required');
    });

    it('rejects non-member', async () => {
      mockPrisma.departmentMembership.findUnique.mockResolvedValue(null);

      await expect(svc.assertManagerOrAdmin('u1', 'd1')).rejects.toThrow('Manager or admin role required');
    });
  });

  describe('getUserDepartmentIds', () => {
    it('returns department IDs for user', async () => {
      mockPrisma.departmentMembership.findMany.mockResolvedValue([
        { departmentId: 'd1' },
        { departmentId: 'd2' },
      ]);

      const result = await svc.getUserDepartmentIds('u1');
      expect(result).toEqual(['d1', 'd2']);
    });

    it('returns empty array when no memberships', async () => {
      mockPrisma.departmentMembership.findMany.mockResolvedValue([]);

      const result = await svc.getUserDepartmentIds('u1');
      expect(result).toEqual([]);
    });
  });
});
