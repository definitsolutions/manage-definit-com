'use client';

import IconRail from './IconRail';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface Props {
  children: React.ReactNode;
  dashboard?: boolean;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { path: '/config', label: 'Configuration', icon: 'settings' },
];

export default function AppShell({ children, dashboard }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/teams/api/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setSyncResult(`${data.chatsProcessed} chats, ${data.tasksDetected} tasks`);
      else setSyncResult(`Error: ${data.error}`);
    } catch { setSyncResult('Sync failed'); }
    finally { setSyncing(false); setTimeout(() => setSyncResult(null), 5000); }
  }

  return (
    <div className="zendesk-layout">
      <IconRail />
      {!collapsed && (
        <div className="context-panel">
          <div className="context-panel-header">
            <span className="context-panel-title">Teams Tasks</span>
            <button className="context-panel-collapse-btn" onClick={() => setCollapsed(true)}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          </div>
          <nav className="context-panel-nav">
            <ul className="context-panel-list">
              {navItems.map(item => {
                const fullPath = `/teams${item.path}`;
                const isActive = item.path === '/dashboard'
                  ? pathname?.startsWith('/teams/dashboard') || pathname === '/teams' || pathname === '/teams/'
                  : pathname?.startsWith(fullPath);
                return (
                  <li key={item.path}>
                    <button className={`context-panel-nav-item ${isActive ? 'active' : ''}`} onClick={() => router.push(item.path)}>
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="context-panel-footer">
            <div className="sync-section">
              <button onClick={handleSync} disabled={syncing} className="sync-btn">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" />
                </svg>
                {syncing ? 'Syncing...' : 'Sync Chats'}
              </button>
              {syncResult && <span className="sync-result">{syncResult}</span>}
            </div>
          </div>
        </div>
      )}
      {collapsed && (
        <button className="context-panel-expand-btn" onClick={() => setCollapsed(false)}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}
      <div className="zendesk-main">
        <main className="zendesk-content">
          {dashboard ? children : <div className="page-content">{children}</div>}
        </main>
      </div>
    </div>
  );
}
