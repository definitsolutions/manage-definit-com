import { prisma } from '../lib/db.js';

export class AuthorizationService {
  async getMembership(userId: string, departmentId: string) {
    return prisma.departmentMembership.findUnique({
      where: {
        userId_departmentId: { userId, departmentId },
      },
    });
  }

  async assertMember(userId: string, departmentId: string) {
    const membership = await this.getMembership(userId, departmentId);
    if (!membership) {
      const error = new Error('Not a member of this department') as any;
      error.statusCode = 403;
      throw error;
    }
    return membership;
  }

  async assertManagerOrAdmin(userId: string, departmentId: string) {
    const membership = await this.getMembership(userId, departmentId);
    if (!membership || membership.role === 'member') {
      const error = new Error('Manager or admin role required') as any;
      error.statusCode = 403;
      throw error;
    }
    return membership;
  }

  async getUserDepartmentIds(userId: string): Promise<string[]> {
    const memberships = await prisma.departmentMembership.findMany({
      where: { userId },
      select: { departmentId: true },
    });
    return memberships.map((m) => m.departmentId);
  }
}

export const authorizationService = new AuthorizationService();
