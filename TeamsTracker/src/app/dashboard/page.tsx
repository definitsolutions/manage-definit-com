'use client';

import { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/AppShell';

interface TaskItem {
  id: string;
  title: string;
  context: string;
  direction: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedBy: string | null;
  assignedByName: string | null;
  detectedAt: string;
  dueDate: string | null;
  aiConfidence: number;
  suggestedAction: string | null;
  chatTopic: string | null;
  chatType: string;
}

interface Stats {
  assignedToMe: number;
  assignedByMe: number;
  commitments: number;
  overdue: number;
  completed: number;
}

type DirectionFilter = 'all' | 'ASSIGNED_TO_ME' | 'ASSIGNED_BY_ME' | 'COMMITMENT';
type StatusFilter = 'open' | 'completed' | 'dismissed';

const directionTabs: Array<{ key: DirectionFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ASSIGNED_TO_ME', label: 'Assigned to Me' },
  { key: 'ASSIGNED_BY_ME', label: 'Assigned by Me' },
  { key: 'COMMITMENT', label: 'My Commitments' },
];

const statusTabs: Array<{ key: StatusFilter; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'completed', label: 'Completed' },
  { key: 'dismissed', label: 'Dismissed' },
];

function priorityColor(p: string): string {
  switch (p) { case 'CRITICAL': return '#ef4444'; case 'HIGH': return '#f97316'; case 'MEDIUM': return '#eab308'; default: return 'var(--gray-400)'; }
}

function directionLabel(d: string): { text: string; color: string } {
  switch (d) {
    case 'ASSIGNED_TO_ME': return { text: 'For Me', color: '#60a5fa' };
    case 'ASSIGNED_BY_ME': return { text: 'Delegated', color: '#c084fc' };
    case 'COMMITMENT': return { text: 'My Promise', color: '#f97316' };
    default: return { text: d, color: 'var(--text-muted)' };
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dirFilter, setDirFilter] = useState<DirectionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { fetch('/teams/api/scheduler', { method: 'POST' }).catch(() => {}); }, []);

  useEffect(() => { loadData(); }, [dirFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter: statusFilter });
      if (dirFilter !== 'all') params.set('direction', dirFilter);
      const res = await fetch(`/teams/api/tasks?${params}`);
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setStats(data.stats ?? null);
      setSelected(new Set());
    } finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.context.toLowerCase().includes(q) ||
      (t.assignedByName?.toLowerCase().includes(q)) ||
      (t.chatTopic?.toLowerCase().includes(q))
    );
  }, [tasks, search]);

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function bulkAction(action: 'complete' | 'dismiss') {
    const endpoint = action === 'complete' ? 'complete' : 'snooze';
    await Promise.all(Array.from(selected).map(id =>
      fetch(`/teams/api/tasks/${id}/${endpoint}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'dismiss' ? JSON.stringify({ hours: 999999 }) : '{}',
      })
    ));
    await loadData();
  }

  async function completeTask(id: string) {
    await fetch(`/teams/api/tasks/${id}/complete/`, { method: 'POST' });
    await loadData();
  }

  return (
    <AppShell dashboard>
      <div className="dashboard-layout">
        <div className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>Teams Tasks</h1>
            {loading && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</span>}
          </div>

          {/* Direction + Status tabs + Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0', flexShrink: 0 }}>
              {directionTabs.map(t => (
                <button key={t.key} onClick={() => setDirFilter(t.key)} style={{
                  fontSize: '13px', fontWeight: dirFilter === t.key ? 600 : 400,
                  color: dirFilter === t.key ? 'var(--primary)' : 'var(--text-muted)',
                  background: dirFilter === t.key ? 'rgba(241,157,35,0.08)' : 'transparent',
                  border: dirFilter === t.key ? '1px solid rgba(241,157,35,0.25)' : '1px solid transparent',
                  padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

            <div style={{ display: 'flex', gap: '0', flexShrink: 0 }}>
              {statusTabs.map(t => (
                <button key={t.key} onClick={() => setStatusFilter(t.key)} style={{
                  fontSize: '12px', fontWeight: statusFilter === t.key ? 600 : 400,
                  color: statusFilter === t.key ? 'var(--text)' : 'var(--gray-400)',
                  background: 'transparent', border: 'none', padding: '6px 10px', cursor: 'pointer',
                  borderBottom: statusFilter === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ flex: 1, position: 'relative', minWidth: '150px' }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
                style={{ width: '100%', fontSize: '13px', padding: '7px 12px 7px 32px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', outline: 'none' }} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{filtered.length} tasks</span>
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 14px', marginTop: '8px', borderRadius: '6px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{selected.size} selected</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button onClick={() => bulkAction('complete')} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.08)', color: '#4ade80', cursor: 'pointer' }}>Complete</button>
                <button onClick={() => bulkAction('dismiss')} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer' }}>Dismiss</button>
                <button onClick={() => setSelected(new Set())} style={{ fontSize: '12px', padding: '5px 8px', border: 'none', background: 'none', color: 'var(--gray-400)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-body">
          <div style={{ display: 'flex', gap: '20px' }}>
            {/* Task list */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {filtered.length === 0 ? (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  No tasks match the current filter.
                </div>
              ) : (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  {filtered.map((task, i) => {
                    const dir = directionLabel(task.direction);
                    const isSelected = selected.has(task.id);
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';
                    return (
                      <div key={task.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent',
                      }}>
                        {/* Checkbox */}
                        <div onClick={() => toggleSelect(task.id)} style={{
                          width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, cursor: 'pointer', marginTop: '2px',
                          border: isSelected ? '2px solid #60a5fa' : '2px solid var(--gray-300)',
                          background: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                        </div>

                        {/* Priority bar */}
                        <div style={{ width: '3px', height: '36px', borderRadius: '2px', background: priorityColor(task.priority), flexShrink: 0, marginTop: '2px' }} />

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: dir.color, background: `${dir.color}20`, padding: '2px 8px', borderRadius: '4px' }}>{dir.text}</span>
                            {task.chatTopic && <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{task.chatTopic}</span>}
                            {isOverdue && <span style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '2px 6px', borderRadius: '4px' }}>Overdue</span>}
                            <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{timeAgo(task.detectedAt)}</span>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}>{task.title}</div>
                          {task.assignedByName && task.direction === 'ASSIGNED_TO_ME' && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>From: {task.assignedByName}</div>
                          )}
                          {task.suggestedAction && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{task.suggestedAction}</div>
                          )}
                          {task.dueDate && (
                            <div style={{ fontSize: '11px', color: isOverdue ? '#ef4444' : 'var(--gray-400)', marginTop: '4px' }}>
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Complete button */}
                        {task.status !== 'COMPLETED' && (
                          <button onClick={() => completeTask(task.id)} title="Mark complete" style={{
                            width: '28px', height: '28px', borderRadius: '50%', border: '2px solid var(--gray-300)',
                            background: 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--gray-400)', transition: 'all 0.15s',
                          }}>
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats sidebar */}
            {stats && (
              <div style={{ width: '180px', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[
                    { label: 'Assigned to Me', value: stats.assignedToMe, color: 'rgba(96,165,250,0.6)' },
                    { label: 'Assigned by Me', value: stats.assignedByMe, color: 'rgba(192,132,252,0.6)' },
                    { label: 'My Commitments', value: stats.commitments, color: 'rgba(249,115,22,0.6)' },
                    { label: 'Overdue', value: stats.overdue, color: 'rgba(239,68,68,0.6)' },
                    { label: 'Completed', value: stats.completed, color: 'rgba(34,197,94,0.6)' },
                  ].map(s => (
                    <div key={s.label} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '6px', borderLeft: `3px solid ${s.color}`,
                      background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeftWidth: '3px', borderLeftColor: s.color,
                    }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.label}</span>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
