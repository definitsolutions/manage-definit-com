'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import ThreadDetail from '@/components/ThreadDetail';
import type { ThreadDetailView } from '@/types';

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const [thread, setThread] = useState<ThreadDetailView | null>(null);
  const [loading, setLoading] = useState(true);

  const threadId = params.id as string;

  useEffect(() => {
    loadThread();
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadThread() {
    setLoading(true);
    try {
      const res = await fetch(`/eer/api/threads/${threadId}`);
      if (res.ok) {
        setThread(await res.json());
      } else {
        setThread(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
          fontSize: '13px', marginBottom: '12px', padding: 0,
        }}
      >
        &larr; Back to dashboard
      </button>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading thread...</p>}

      {!loading && !thread && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
          padding: '32px', textAlign: 'center', color: 'var(--text-muted)',
        }}>
          Thread not found.
        </div>
      )}

      {thread && <ThreadDetail thread={thread} onStatusChange={() => router.push('/dashboard')} />}
    </AppShell>
  );
}
