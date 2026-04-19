'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Session {
  displayName?: string;
  email?: string;
  isLoggedIn?: boolean;
}

export default function Header() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
          EER
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
            Dashboard
          </Link>
          <Link href="/digest" className="text-gray-600 hover:text-gray-900">
            Digest
          </Link>
          <Link href="/config" className="text-gray-600 hover:text-gray-900">
            Config
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {session?.displayName && (
          <span className="text-gray-500">{session.displayName}</span>
        )}
        <SyncButton />
      </div>
    </header>
  );
}

function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResult(`Synced ${data.messagesProcessed} messages, ${data.threadsUpdated} threads`);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch {
      setResult('Sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setResult(null), 5000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-gray-500">{result}</span>}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
      >
        {syncing ? 'Syncing...' : 'Sync Mail'}
      </button>
    </div>
  );
}
