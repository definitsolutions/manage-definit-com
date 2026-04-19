import { describe, it, expect } from 'vitest';
import { AuditService } from '../src/server/services/audit.js';

const auditService = new AuditService();

describe('AuditService.diff', () => {
  it('detects changed fields', () => {
    const old = { title: 'Old Title', status: 'not_started', ownerId: 'u1' };
    const updated = { title: 'New Title', status: 'not_started', ownerId: 'u1' };
    const result = auditService.diff(old, updated, ['title', 'status', 'ownerId']);

    expect(result).not.toBeNull();
    expect(result!.title).toEqual({ old: 'Old Title', new: 'New Title' });
    expect(result!.status).toBeUndefined();
  });

  it('returns null when nothing changed', () => {
    const obj = { title: 'Same', status: 'done' };
    const result = auditService.diff(obj, obj, ['title', 'status']);
    expect(result).toBeNull();
  });

  it('detects multiple changes', () => {
    const old = { status: 'not_started', proofLink: null, completionNote: null };
    const updated = { status: 'done', proofLink: 'https://proof.com', completionNote: 'Done' };
    const result = auditService.diff(old, updated, ['status', 'proofLink', 'completionNote']);

    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toHaveLength(3);
  });

  it('handles null to value transitions', () => {
    const old = { ownerId: null };
    const updated = { ownerId: 'u1' };
    const result = auditService.diff(old, updated, ['ownerId']);

    expect(result).not.toBeNull();
    expect(result!.ownerId).toEqual({ old: null, new: 'u1' });
  });
});
