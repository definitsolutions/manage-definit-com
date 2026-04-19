'use client';

import type { DashboardStats } from '@/types';

interface Props {
  stats: DashboardStats;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const cards: Array<{ key: keyof DashboardStats; label: string; filter: string; color: string }> = [
  { key: 'needsReply', label: 'Needs Reply', filter: 'needs_reply', color: 'rgba(239,68,68,0.6)' },
  { key: 'waitingOnTeam', label: 'Waiting on Team', filter: 'waiting_on_team', color: 'rgba(249,115,22,0.6)' },
  { key: 'staleThreads', label: 'Stale Threads', filter: 'stale', color: 'rgba(234,179,8,0.6)' },
  { key: 'promisesMade', label: 'Promises', filter: 'promises', color: 'rgba(168,85,247,0.6)' },
  { key: 'vipHighPriority', label: 'VIP', filter: 'vip', color: 'rgba(59,130,246,0.6)' },
  { key: 'hasTicket', label: 'Has Ticket', filter: 'flagged', color: 'rgba(34,197,94,0.6)' },
  { key: 'delegated', label: 'Delegated', filter: 'all', color: 'rgba(100,116,139,0.6)' },
  { key: 'totalFlagged', label: 'Total Flagged', filter: 'flagged', color: 'var(--gray-400)' },
];

export default function KpiCards({ stats, activeFilter, onFilterChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {cards.map((card) => {
        const isActive = activeFilter === card.filter;
        return (
          <button
            key={card.key}
            onClick={() => onFilterChange(card.filter)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '6px',
              borderLeft: `3px solid ${card.color}`,
              background: isActive ? 'rgba(59,130,246,0.08)' : 'var(--bg-card)',
              border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border)',
              borderLeftWidth: '3px',
              borderLeftColor: card.color,
              cursor: 'pointer',
              transition: 'all 0.1s',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{card.label}</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{stats[card.key]}</span>
          </button>
        );
      })}
    </div>
  );
}
