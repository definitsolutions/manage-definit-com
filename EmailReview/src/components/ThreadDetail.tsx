'use client';

import { useState } from 'react';
import type { ThreadDetailView } from '@/types';
import AiSummary from './AiSummary';
import ReplyDraft from './ReplyDraft';

interface Props {
  thread: ThreadDetailView;
  onStatusChange?: () => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  overflow: 'hidden',
};

export default function ThreadDetail({ thread, onStatusChange }: Props) {
  const [reviewNote, setReviewNote] = useState('');
  const [updating, setUpdating] = useState(false);

  async function updateStatus(action: 'review' | 'dismiss' | 'reopen') {
    setUpdating(true);
    try {
      await fetch(`/eer/api/threads/${thread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: reviewNote || undefined }),
      });
      onStatusChange?.();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div style={{ maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Thread Header ── */}
      <div style={card}>
        <div style={{ padding: '20px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>
              {thread.subject}
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {thread.status === 'OPEN' && (
                <>
                  <button onClick={() => updateStatus('review')} disabled={updating} style={actionBtn('#22c55e')}>
                    Mark Reviewed
                  </button>
                  <button onClick={() => updateStatus('dismiss')} disabled={updating} style={actionBtn('var(--gray-400)')}>
                    Dismiss
                  </button>
                </>
              )}
              {(thread.status === 'REVIEWED' || thread.status === 'DISMISSED') && (
                <button onClick={() => updateStatus('reopen')} disabled={updating} style={actionBtn('#3b82f6')}>
                  Reopen
                </button>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            {thread.companyName && (
              <span style={{ fontWeight: 600, color: '#60a5fa' }}>{thread.companyName}</span>
            )}
            <span>{thread.messageCount} messages</span>
            <span>Score: {thread.priorityScore}/100</span>
            <span style={{ textTransform: 'capitalize' }}>{thread.status.toLowerCase()}</span>
          </div>

          {/* Flags */}
          {thread.flags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {thread.flags.map((flag) => (
                <span key={flag.id} style={flagBadge(flag.severity)}>
                  {flag.description}
                </span>
              ))}
            </div>
          )}

          {/* Note input */}
          <input
            type="text"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Add a note (optional)..."
            style={{
              width: '100%',
              fontSize: '13px',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />

          {thread.reviewedAt && (
            <div style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '8px' }}>
              Reviewed {timeAgo(thread.reviewedAt)}
              {thread.reviewNote && <> — &quot;{thread.reviewNote}&quot;</>}
            </div>
          )}
        </div>
      </div>

      {/* ── AI Analysis ── */}
      {thread.aiAnalysis && <AiSummary analysis={thread.aiAnalysis} />}

      {/* ── Reply Draft ── */}
      <ReplyDraft threadId={thread.id} existingDraft={thread.aiAnalysis?.draftReply ?? null} />

      {/* ── Conversation ── */}
      <div style={card}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
            Conversation ({thread.messages.length})
          </span>
        </div>
        <div>
          {thread.messages.map((msg, i) => {
            const isOut = msg.direction === 'OUTBOUND';
            return (
              <div
                key={msg.id}
                style={{
                  padding: '16px 20px',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  background: isOut ? 'rgba(59,130,246,0.04)' : 'transparent',
                }}
              >
                {/* Sender row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isOut ? 'rgba(59,130,246,0.15)' : 'var(--gray-200)',
                      color: isOut ? '#60a5fa' : 'var(--text-muted)',
                      letterSpacing: '0.03em',
                    }}>
                      {isOut ? 'OUT' : 'IN'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      {msg.senderName ?? msg.senderEmail}
                    </span>
                    {msg.isClientRelated && msg.isExternal && (
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                        Client
                      </span>
                    )}
                    {!msg.isRead && msg.direction === 'INBOUND' && (
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
                        Unread
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--gray-400)', flexShrink: 0 }}>
                    {new Date(msg.receivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                    {new Date(msg.receivedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>

                {/* Body */}
                <div style={{
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  paddingLeft: '36px',
                }}>
                  {msg.bodyPreview}
                </div>

                {/* Categories */}
                {msg.categories.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px', paddingLeft: '36px' }}>
                    {msg.categories.map((cat) => (
                      <span key={cat} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--gray-200)', color: 'var(--text-muted)' }}>
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {thread.messages.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No messages loaded. Run a sync to fetch conversation content.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    fontSize: '12px',
    fontWeight: 500,
    padding: '6px 14px',
    borderRadius: '6px',
    border: `1px solid ${color}`,
    background: 'transparent',
    color: color,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function flagBadge(severity: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontWeight: 500,
    lineHeight: 1.4,
  };
  switch (severity) {
    case 'CRITICAL': return { ...base, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' };
    case 'HIGH': return { ...base, background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' };
    case 'MEDIUM': return { ...base, background: 'rgba(234,179,8,0.12)', color: '#facc15', border: '1px solid rgba(234,179,8,0.25)' };
    default: return { ...base, background: 'var(--gray-100)', color: 'var(--text-muted)' };
  }
}
