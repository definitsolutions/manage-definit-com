'use client';

import type { AIAnalysisView } from '@/types';

interface Props {
  analysis: AIAnalysisView;
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '20px',
};

function classificationStyle(c: string): React.CSSProperties {
  const base: React.CSSProperties = { fontSize: '11px', padding: '3px 8px', borderRadius: '10px', fontWeight: 600 };
  switch (c) {
    case 'needs_action': return { ...base, background: 'rgba(239,68,68,0.12)', color: '#f87171' };
    case 'monitoring': return { ...base, background: 'rgba(234,179,8,0.12)', color: '#facc15' };
    case 'resolved': return { ...base, background: 'rgba(34,197,94,0.12)', color: '#4ade80' };
    case 'informational': return { ...base, background: 'rgba(59,130,246,0.12)', color: '#60a5fa' };
    default: return { ...base, background: 'var(--gray-100)', color: 'var(--text-muted)' };
  }
}

function priorityColor(p: string): string {
  switch (p) {
    case 'critical': return '#f87171';
    case 'high': return '#fb923c';
    case 'medium': return '#facc15';
    case 'low': return 'var(--text-muted)';
    default: return 'var(--text-muted)';
  }
}

export default function AiSummary({ analysis }: Props) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>AI Analysis</span>
        <span style={classificationStyle(analysis.classification)}>
          {analysis.classification.replace('_', ' ')}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: priorityColor(analysis.priority) }}>
          {analysis.priority} priority
        </span>
        <span style={{ fontSize: '11px', color: 'var(--gray-400)', marginLeft: 'auto' }}>
          {analysis.model} &middot; {new Date(analysis.analyzedAt).toLocaleDateString()}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {analysis.summary && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Summary</div>
            <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>{analysis.summary}</div>
          </div>
        )}
        {analysis.suggestedAction && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Suggested Action</div>
            <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>{analysis.suggestedAction}</div>
          </div>
        )}
        {analysis.explanation && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Why Flagged</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{analysis.explanation}</div>
          </div>
        )}
      </div>
    </div>
  );
}
