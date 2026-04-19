'use client';

import { useState } from 'react';

interface Props {
  threadId: string;
  existingDraft: string | null;
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '20px',
};

export default function ReplyDraft({ threadId, existingDraft }: Props) {
  const [draft, setDraft] = useState(existingDraft ?? '');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateDraft() {
    setGenerating(true);
    try {
      const res = await fetch(`/eer/api/threads/${threadId}/draft/`, { method: 'POST' });
      const data = await res.json();
      if (data.draft) setDraft(data.draft);
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Reply Draft</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={generateDraft}
            disabled={generating}
            style={{
              fontSize: '12px', fontWeight: 500, padding: '6px 12px', borderRadius: '6px',
              border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)',
              color: '#60a5fa', cursor: 'pointer', opacity: generating ? 0.5 : 1,
            }}
          >
            {generating ? 'Generating...' : draft ? 'Regenerate' : 'Generate Draft'}
          </button>
          {draft && (
            <button
              onClick={copyToClipboard}
              style={{
                fontSize: '12px', fontWeight: 500, padding: '6px 12px', borderRadius: '6px',
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        placeholder="Click 'Generate Draft' to create an AI-suggested reply, or write your own..."
        style={{
          width: '100%',
          fontSize: '13px',
          lineHeight: 1.6,
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          color: 'var(--text)',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '8px' }}>
        Draft is for reference only. Copy and paste into Outlook to send.
      </div>
    </div>
  );
}
