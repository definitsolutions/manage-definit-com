'use client';

import AppShell from '@/components/AppShell';
import ConfigPanel from '@/components/ConfigPanel';

export default function ConfigPage() {
  return (
    <AppShell>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>Configuration</h1>
      <ConfigPanel />

      {/* Account section at bottom of config */}
      <div style={{
        maxWidth: '800px',
        marginTop: '24px',
        padding: '16px 20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Signed in as Microsoft 365 account</span>
        <a
          href="/eer/api/auth/logout/"
          style={{
            fontSize: '13px',
            color: '#f87171',
            textDecoration: 'none',
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.08)',
          }}
        >
          Sign out
        </a>
      </div>
    </AppShell>
  );
}
