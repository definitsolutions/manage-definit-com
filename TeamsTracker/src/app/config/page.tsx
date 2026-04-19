'use client';

import AppShell from '@/components/AppShell';

export default function ConfigPage() {
  return (
    <AppShell>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>Configuration</h1>
      <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>About</div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Teams Task Tracker scans your Microsoft Teams chats for action items, task assignments,
            and commitments. It detects tasks assigned to you, tasks you&apos;ve delegated, and promises
            you&apos;ve made — then tracks whether they&apos;ve been completed.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '8px' }}>
            Syncs automatically every 15 minutes. AI classification confirms detected tasks and filters
            out casual conversation.
          </p>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Signed in as Microsoft 365 account</span>
          <a href="/teams/api/auth/logout/" style={{
            fontSize: '13px', color: '#f87171', textDecoration: 'none', padding: '6px 14px',
            borderRadius: '6px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)',
          }}>Sign out</a>
        </div>
      </div>
    </AppShell>
  );
}
