'use client';

import { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import KpiCards from '@/components/KpiCards';
import ThreadList from '@/components/ThreadList';
import type { DashboardStats, ThreadListItem } from '@/types';

type StatusTab = 'needs_reply' | 'reviewed' | 'all';

const tabs: Array<{ key: StatusTab; label: string }> = [
  { key: 'needs_reply', label: 'Needs Reply' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'all', label: 'All' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [filter, setFilter] = useState('flagged');
  const [statusTab, setStatusTab] = useState<StatusTab>('needs_reply');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState(false);

  useEffect(() => {
    fetch('/eer/api/scheduler', { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [filter, statusTab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter });
      if (statusTab === 'reviewed') params.set('status', 'reviewed');
      if (statusTab === 'all') params.set('filter', 'all');
      const res = await fetch(`/eer/api/threads?${params}`);
      const data = await res.json();
      setStats(data.stats);
      setThreads(data.threads);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(f: string) {
    setFilter(f);
    setStatusTab('needs_reply');
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t =>
      t.subject.toLowerCase().includes(q) ||
      (t.companyName?.toLowerCase().includes(q)) ||
      (t.lastSenderEmail?.toLowerCase().includes(q)) ||
      (t.aiSummary?.toLowerCase().includes(q)) ||
      t.flags.some(f => f.description.toLowerCase().includes(q))
    );
  }, [threads, search]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(t => t.id)));
    }
  }

  async function handleBulkAction(action: 'review' | 'dismiss') {
    setBulkAction(true);
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          fetch(`/eer/api/threads/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          })
        )
      );
      await loadData();
    } finally {
      setBulkAction(false);
    }
  }

  return (
    <AppShell dashboard>
      <div className="dashboard-layout">
        {/* ── Fixed header: title, tabs, search ── */}
        <div className="dashboard-header">
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>Dashboard</h1>
            {loading && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</span>}
          </div>

          {/* Tabs + Search row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0', flexShrink: 0 }}>
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusTab(tab.key)}
                  style={{
                    fontSize: '13px',
                    fontWeight: statusTab === tab.key ? 600 : 400,
                    color: statusTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                    background: statusTab === tab.key ? 'rgba(241,157,35,0.08)' : 'transparent',
                    border: statusTab === tab.key ? '1px solid rgba(241,157,35,0.25)' : '1px solid transparent',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Select All */}
            <div
              onClick={toggleSelectAll}
              title={selected.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}
              style={{
                width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, cursor: 'pointer',
                border: selected.size > 0 ? '2px solid #60a5fa' : '2px solid var(--gray-300)',
                background: selected.size === filtered.length && filtered.length > 0 ? 'rgba(59,130,246,0.15)' : selected.size > 0 ? 'rgba(59,130,246,0.08)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s',
              }}
            >
              {selected.size === filtered.length && filtered.length > 0 ? (
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : selected.size > 0 ? (
                <div style={{ width: '8px', height: '2px', background: '#60a5fa', borderRadius: '1px' }} />
              ) : null}
            </div>

            {/* Search */}
            <div style={{ flex: 1, position: 'relative' }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                style={{
                  width: '100%', fontSize: '13px', padding: '7px 12px 7px 32px', borderRadius: '6px',
                  border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', outline: 'none',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: '16px' }}>
                  &times;
                </button>
              )}
            </div>

            <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} threads
            </span>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 14px', marginTop: '8px',
              borderRadius: '6px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            }}>
              <button onClick={toggleSelectAll} style={{ fontSize: '12px', color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
              </button>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{selected.size} selected</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                {statusTab !== 'reviewed' && (
                  <button onClick={() => handleBulkAction('review')} disabled={bulkAction}
                    style={{ fontSize: '12px', fontWeight: 500, padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.08)', color: '#4ade80', cursor: 'pointer', opacity: bulkAction ? 0.5 : 1 }}>
                    Mark Reviewed
                  </button>
                )}
                <button onClick={() => handleBulkAction('dismiss')} disabled={bulkAction}
                  style={{ fontSize: '12px', fontWeight: 500, padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer', opacity: bulkAction ? 0.5 : 1 }}>
                  Dismiss
                </button>
                <button onClick={() => setSelected(new Set())}
                  style={{ fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: 'none', background: 'none', color: 'var(--gray-400)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Scrollable body: thread list + KPI sidebar ── */}
        <div className="dashboard-body">
          <div style={{ display: 'flex', gap: '20px' }}>
            {/* Thread list — takes remaining space */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <ThreadList threads={filtered} selectable selected={selected} onToggleSelect={toggleSelect} />
            </div>

            {/* KPI sidebar — fixed width on right */}
            {stats && (
              <div style={{ width: '200px', flexShrink: 0 }}>
                <div style={{ position: 'sticky', top: 0 }}>
                  <KpiCards stats={stats} activeFilter={filter} onFilterChange={handleFilterChange} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
