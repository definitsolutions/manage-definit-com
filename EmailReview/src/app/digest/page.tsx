'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import DigestView from '@/components/DigestView';
import type { DigestContent } from '@/types';

export default function DigestPage() {
  const [digest, setDigest] = useState<DigestContent | null>(null);
  const [plainText, setPlainText] = useState<string | null>(null);
  const [showPlainText, setShowPlainText] = useState(false);

  async function generateDigest() {
    const res = await fetch('/eer/api/digest', { method: 'POST' });
    const data = await res.json();
    setDigest(data.content);
    setPlainText(data.plainText ?? null);
  }

  return (
    <AppShell>
      <DigestView digest={digest} onGenerate={generateDigest} />

      {plainText && (
        <div style={{ marginTop: '24px' }}>
          <button
            onClick={() => setShowPlainText((p) => !p)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}
          >
            {showPlainText ? 'Hide' : 'Show'} plain text version
          </button>
          {showPlainText && (
            <pre style={{
              marginTop: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '16px', fontSize: '12px', color: 'var(--text)',
              whiteSpace: 'pre-wrap', fontFamily: 'monospace', overflowX: 'auto',
            }}>
              {plainText}
            </pre>
          )}
        </div>
      )}
    </AppShell>
  );
}
