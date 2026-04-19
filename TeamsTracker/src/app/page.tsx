'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/teams/api/auth/session/').then(r => { if (r.ok) router.replace('/dashboard'); else setChecking(false); }).catch(() => setChecking(false));
  }, [router]);

  if (checking) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'var(--text-muted)' }}>Checking session...</p></div>;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Teams Task Tracker</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Track tasks and follow-ups from Teams chats.</p>
        <a href="/teams/api/auth/login/" style={{ display: 'inline-block', background: 'var(--primary)', color: '#fff', padding: '10px 24px', borderRadius: '6px', fontWeight: 500, textDecoration: 'none', fontSize: '14px' }}>Sign in with Microsoft</a>
      </div>
    </div>
  );
}
