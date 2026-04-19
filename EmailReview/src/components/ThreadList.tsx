'use client';

import Link from 'next/link';
import type { ThreadListItem } from '@/types';

interface Props {
  threads: ThreadListItem[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function severityBadge(severity: string): React.CSSProperties {
  const base: React.CSSProperties = { fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 };
  switch (severity) {
    case 'CRITICAL': return { ...base, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' };
    case 'HIGH': return { ...base, background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' };
    case 'MEDIUM': return { ...base, background: 'rgba(234,179,8,0.15)', color: '#facc15', border: '1px solid rgba(234,179,8,0.3)' };
    case 'LOW': return { ...base, background: 'var(--gray-100)', color: 'var(--text-muted)' };
    default: return { ...base, background: 'var(--gray-100)', color: 'var(--text-muted)' };
  }
}

function flagLabel(flagType: string): string {
  switch (flagType) {
    case 'VIP_NEEDS_ATTENTION': return 'VIP';
    case 'URGENCY_LANGUAGE': return 'Urgent';
    case 'CLIENT_AWAITING_REPLY': return 'Awaiting Reply';
    case 'NO_INTERNAL_REPLY': return 'No Reply';
    case 'STALE_THREAD': return 'Stale';
    case 'COMMITMENT_NO_FOLLOWUP': return 'Promise';
    case 'UNREAD_AGED': return 'Unread';
    default: return flagType;
  }
}

function priorityBarColor(score: number): string {
  if (score >= 80) return '#ef4444';
  if (score >= 60) return '#f97316';
  if (score >= 35) return '#eab308';
  return 'var(--gray-300)';
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const checkboxStyle = (checked: boolean): React.CSSProperties => ({
  width: '16px',
  height: '16px',
  borderRadius: '4px',
  border: checked ? '2px solid #60a5fa' : '2px solid var(--gray-300)',
  background: checked ? 'rgba(59,130,246,0.15)' : 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'all 0.1s',
});

export default function ThreadList({ threads, selectable, selected, onToggleSelect }: Props) {
  if (threads.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
        padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px',
      }}>
        No threads match the current filter.
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      {threads.map((thread, i) => {
        const isSelected = selected?.has(thread.id) ?? false;

        return (
          <div
            key={thread.id}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            {/* Checkbox column */}
            {selectable && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '18px 0 18px 16px',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSelect?.(thread.id);
                }}
              >
                <div style={checkboxStyle(isSelected)}>
                  {isSelected && (
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </div>
              </div>
            )}

            {/* Thread content (clickable link) */}
            <Link
              href={`/thread/${thread.id}/`}
              style={{
                display: 'block',
                flex: 1,
                padding: selectable ? '16px 20px 16px 12px' : '16px 20px',
                textDecoration: 'none',
                color: 'inherit',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.parentElement!.style.background = 'var(--gray-100)'; }}
              onMouseLeave={e => { e.currentTarget.parentElement!.style.background = isSelected ? 'rgba(59,130,246,0.06)' : 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                {/* Priority bar */}
                <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                  <div style={{ width: '3px', height: '40px', borderRadius: '2px', background: priorityBarColor(thread.priorityScore) }} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Row 1: Company + meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {thread.companyName && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#60a5fa', background: 'rgba(59,130,246,0.12)', padding: '2px 8px', borderRadius: '4px' }}>
                        {thread.companyName}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>
                      {thread.messageCount} msg{thread.messageCount !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>
                      {thread.lastClientMessageAt ? timeAgo(thread.lastClientMessageAt) : timeAgo(thread.lastMessageAt)}
                    </span>
                  </div>

                  {/* Row 2: Subject */}
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
                    {thread.subject}
                  </div>

                  {/* Row 3: Sender */}
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {thread.lastSenderEmail}
                  </div>

                  {/* Row 4: Flags + delegation badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {thread.hasTicket && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                        Ticket
                      </span>
                    )}
                    {thread.hasDelegation && !thread.hasTicket && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}>
                        Delegated
                      </span>
                    )}
                    {thread.flags.map((flag) => (
                      <span key={flag.id} style={severityBadge(flag.severity)} title={flag.description}>
                        {flagLabel(flag.flagType)}
                      </span>
                    ))}
                  </div>

                  {/* Row 5: AI summary */}
                  {thread.aiSummary && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {thread.aiSummary}
                    </div>
                  )}
                </div>

                {/* Score */}
                <div style={{ flexShrink: 0, textAlign: 'right', paddingLeft: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{thread.priorityScore}</div>
                  <div style={{ fontSize: '10px', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>score</div>
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
