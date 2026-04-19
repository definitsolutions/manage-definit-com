'use client';

import { useState, useEffect, useMemo } from 'react';
import type { AppConfig } from '@/types';

interface ClientDomain {
  id: string;
  domain: string;
  companyName: string | null;
}

interface VipContact {
  id: string;
  email: string;
  name: string | null;
  companyName: string | null;
  priority: number;
}

interface IgnoredDomain {
  id: string;
  domain: string;
  reason: string | null;
}

interface ConfigData {
  config: AppConfig;
  clientDomains: ClientDomain[];
  vipContacts: VipContact[];
  ignoredDomains: IgnoredDomain[];
}

// ── Shared styles ──

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  overflow: 'hidden',
};

const sectionHeader = (collapsed: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 20px',
  cursor: 'pointer',
  userSelect: 'none',
  borderBottom: collapsed ? 'none' : '1px solid var(--border)',
});

const sectionTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const countBadge: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '10px',
  background: 'var(--gray-200)',
  color: 'var(--text-muted)',
};

const chevron = (collapsed: boolean): React.CSSProperties => ({
  fontSize: '12px',
  color: 'var(--text-muted)',
  transition: 'transform 0.15s',
  transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
});

const sectionBody: React.CSSProperties = {
  padding: '16px 20px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-muted)',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '13px',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
};

const inlineInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: 'auto',
  flex: 1,
};

const btnPrimary: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  padding: '8px 16px',
  borderRadius: '6px',
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  cursor: 'pointer',
};

const btnSmall: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  fontSize: '11px',
  padding: '4px 10px',
  borderRadius: '4px',
  border: 'none',
  background: 'rgba(239,68,68,0.1)',
  color: '#f87171',
  cursor: 'pointer',
};

const listRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderRadius: '6px',
  background: 'var(--bg)',
  marginBottom: '4px',
};

const addRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginTop: '12px',
  paddingTop: '12px',
  borderTop: '1px solid var(--border)',
};

const pillStyle = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-block',
  fontSize: '11px',
  padding: '4px 10px',
  borderRadius: '12px',
  background: bg,
  color: color,
  border: `1px solid ${border}`,
  margin: '3px',
});

// ── Chevron SVG ──

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={chevron(collapsed)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ── Company group header ──

const companyGroupStyle: React.CSSProperties = {
  marginBottom: '8px',
};

const companyGroupHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 0',
  cursor: 'pointer',
  userSelect: 'none',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text)',
};

const companyDomainCount: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--text-muted)',
};

// ── Main Component ──

export default function ConfigPanel() {
  const [data, setData] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Section collapse state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    thresholds: false,
    domains: true,
    vips: true,
    ignored: true,
    urgency: true,
    commitments: true,
  });

  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const [syncDays, setSyncDays] = useState(7);
  const [staleHours, setStaleHours] = useState(48);
  const [unreadHours, setUnreadHours] = useState(24);
  const [digestTime, setDigestTime] = useState('07:00');
  const [digestTopN, setDigestTopN] = useState(10);

  const [newDomain, setNewDomain] = useState('');
  const [newDomainCompany, setNewDomainCompany] = useState('');
  const [newVipEmail, setNewVipEmail] = useState('');
  const [newVipName, setNewVipName] = useState('');
  const [newVipCompany, setNewVipCompany] = useState('');
  const [newVipPriority, setNewVipPriority] = useState(1);
  const [newIgnoredDomain, setNewIgnoredDomain] = useState('');
  const [newIgnoredReason, setNewIgnoredReason] = useState('');

  // Expanded company groups within client domains
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

  useEffect(() => { loadConfig(); }, []);

  // Group client domains by company
  const domainsByCompany = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, ClientDomain[]>();
    for (const d of data.clientDomains) {
      const key = d.companyName || '(No company)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  function toggleCompany(name: string) {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch('/eer/api/config');
      const json = await res.json();
      setData(json);
      setSyncDays(json.config.syncDays);
      setStaleHours(json.config.staleHours);
      setUnreadHours(json.config.unreadHours);
      setDigestTime(json.config.digestTime);
      setDigestTopN(json.config.digestTopN);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setMessage(null);
    try {
      await fetch('/eer/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', config: { syncDays, staleHours, unreadHours, digestTime, digestTopN } }),
      });
      setMessage('Saved');
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function postConfig(body: Record<string, unknown>) {
    await fetch('/eer/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    loadConfig();
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Thresholds ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader(collapsed.thresholds)} onClick={() => toggle('thresholds')}>
          <div style={sectionTitle}>Thresholds &amp; Timing</div>
          <Chevron collapsed={collapsed.thresholds} />
        </div>
        {!collapsed.thresholds && (
          <div style={sectionBody}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Sync lookback (days)</label>
                <input type="number" value={syncDays} onChange={e => setSyncDays(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Stale threshold (hours)</label>
                <input type="number" value={staleHours} onChange={e => setStaleHours(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Unread threshold (hours)</label>
                <input type="number" value={unreadHours} onChange={e => setUnreadHours(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Digest time</label>
                <input type="time" value={digestTime} onChange={e => setDigestTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Digest top N items</label>
                <input type="number" value={digestTopN} onChange={e => setDigestTopN(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={saveConfig} disabled={saving} style={btnPrimary}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              {message && <span style={{ fontSize: '13px', color: 'var(--success)' }}>{message}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── Client Domains (grouped by company, collapsible) ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader(collapsed.domains)} onClick={() => toggle('domains')}>
          <div style={sectionTitle}>
            Client Domains
            <span style={countBadge}>{data?.clientDomains.length ?? 0}</span>
          </div>
          <Chevron collapsed={collapsed.domains} />
        </div>
        {!collapsed.domains && (
          <div style={sectionBody}>
            {domainsByCompany.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>No client domains configured yet.</div>
            )}
            {domainsByCompany.map(([company, domains]) => {
              const isExpanded = expandedCompanies.has(company);
              return (
                <div key={company} style={companyGroupStyle}>
                  <div style={companyGroupHeader} onClick={() => toggleCompany(company)}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                    {company}
                    <span style={companyDomainCount}>
                      {domains.length} domain{domains.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{ paddingLeft: '20px' }}>
                      {domains.map(d => (
                        <div key={d.id} style={{ ...listRow, marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text)' }}>{d.domain}</span>
                          <button onClick={() => postConfig({ action: 'remove_client_domain', id: d.id })} style={btnDanger}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={addRow}>
              <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="domain.com" style={{ ...inlineInputStyle, maxWidth: '200px' }} />
              <input value={newDomainCompany} onChange={e => setNewDomainCompany(e.target.value)} placeholder="Company name" style={{ ...inlineInputStyle, maxWidth: '240px' }} />
              <button onClick={() => { if (newDomain.trim()) { postConfig({ action: 'add_client_domain', domain: newDomain, companyName: newDomainCompany || undefined }); setNewDomain(''); setNewDomainCompany(''); } }} style={btnSmall}>Add</button>
            </div>
          </div>
        )}
      </div>

      {/* ── VIP Contacts ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader(collapsed.vips)} onClick={() => toggle('vips')}>
          <div style={sectionTitle}>
            VIP Contacts
            <span style={countBadge}>{data?.vipContacts.length ?? 0}</span>
          </div>
          <Chevron collapsed={collapsed.vips} />
        </div>
        {!collapsed.vips && (
          <div style={sectionBody}>
            {data?.vipContacts.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>No VIP contacts configured yet.</div>
            )}
            {data?.vipContacts.map(v => (
              <div key={v.id} style={listRow}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{v.email}</span>
                  {v.name && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>{v.name}</span>}
                  {v.companyName && <span style={{ fontSize: '12px', color: 'var(--gray-400)', marginLeft: '4px' }}>({v.companyName})</span>}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#f97316', marginLeft: '8px' }}>P{v.priority}</span>
                </div>
                <button onClick={() => postConfig({ action: 'remove_vip_contact', id: v.id })} style={btnDanger}>Remove</button>
              </div>
            ))}
            <div style={addRow}>
              <input value={newVipEmail} onChange={e => setNewVipEmail(e.target.value)} placeholder="email@domain.com" style={{ ...inlineInputStyle, maxWidth: '200px' }} />
              <input value={newVipName} onChange={e => setNewVipName(e.target.value)} placeholder="Name" style={{ ...inlineInputStyle, maxWidth: '140px' }} />
              <input value={newVipCompany} onChange={e => setNewVipCompany(e.target.value)} placeholder="Company" style={{ ...inlineInputStyle, maxWidth: '140px' }} />
              <select value={newVipPriority} onChange={e => setNewVipPriority(Number(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '7px 8px' }}>
                <option value={1}>P1</option>
                <option value={2}>P2</option>
                <option value={3}>P3</option>
              </select>
              <button onClick={() => { if (newVipEmail.trim()) { postConfig({ action: 'add_vip_contact', email: newVipEmail, name: newVipName || undefined, companyName: newVipCompany || undefined, priority: newVipPriority }); setNewVipEmail(''); setNewVipName(''); setNewVipCompany(''); setNewVipPriority(1); } }} style={btnSmall}>Add</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Ignored Domains ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader(collapsed.ignored)} onClick={() => toggle('ignored')}>
          <div style={sectionTitle}>
            Ignored Domains
            <span style={countBadge}>{data?.ignoredDomains.length ?? 0}</span>
          </div>
          <Chevron collapsed={collapsed.ignored} />
        </div>
        {!collapsed.ignored && (
          <div style={sectionBody}>
            {data?.ignoredDomains.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>No ignored domains configured yet.</div>
            )}
            {data?.ignoredDomains.map(d => (
              <div key={d.id} style={listRow}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{d.domain}</span>
                  {d.reason && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>{d.reason}</span>}
                </div>
                <button onClick={() => postConfig({ action: 'remove_ignored_domain', id: d.id })} style={btnDanger}>Remove</button>
              </div>
            ))}
            <div style={addRow}>
              <input value={newIgnoredDomain} onChange={e => setNewIgnoredDomain(e.target.value)} placeholder="domain.com" style={{ ...inlineInputStyle, maxWidth: '200px' }} />
              <input value={newIgnoredReason} onChange={e => setNewIgnoredReason(e.target.value)} placeholder="Reason (optional)" style={{ ...inlineInputStyle, maxWidth: '240px' }} />
              <button onClick={() => { if (newIgnoredDomain.trim()) { postConfig({ action: 'add_ignored_domain', domain: newIgnoredDomain, reason: newIgnoredReason || undefined }); setNewIgnoredDomain(''); setNewIgnoredReason(''); } }} style={btnSmall}>Add</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Urgency Keywords ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader(collapsed.urgency)} onClick={() => toggle('urgency')}>
          <div style={sectionTitle}>
            Urgency Keywords
            <span style={countBadge}>{data?.config.urgencyKeywords.length ?? 0}</span>
          </div>
          <Chevron collapsed={collapsed.urgency} />
        </div>
        {!collapsed.urgency && (
          <div style={sectionBody}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {data?.config.urgencyKeywords.map(kw => (
                <span key={kw} style={pillStyle('rgba(239,68,68,0.1)', '#f87171', 'rgba(239,68,68,0.25)')}>{kw}</span>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '10px' }}>Editable via API. UI keyword editor in V2.</div>
          </div>
        )}
      </div>

      {/* ── Commitment Phrases ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader(collapsed.commitments)} onClick={() => toggle('commitments')}>
          <div style={sectionTitle}>
            Commitment Phrases
            <span style={countBadge}>{data?.config.commitmentPhrases.length ?? 0}</span>
          </div>
          <Chevron collapsed={collapsed.commitments} />
        </div>
        {!collapsed.commitments && (
          <div style={sectionBody}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {data?.config.commitmentPhrases.map(p => (
                <span key={p} style={pillStyle('rgba(168,85,247,0.1)', '#c084fc', 'rgba(168,85,247,0.25)')}>{p}</span>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '10px' }}>Editable via API. UI phrase editor in V2.</div>
          </div>
        )}
      </div>
    </div>
  );
}
