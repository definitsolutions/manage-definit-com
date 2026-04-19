import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PhoneIncoming, PhoneOutgoing, Clock, FileText, Mail, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api/client';

interface Recording {
  id: string;
  phone_number: string;
  direction: string;
  started_at: string;
  duration_seconds: number | null;
  transcript_status: string;
  email_sent: boolean;
  has_notes: boolean;
  created_at: string;
}

export default function RecordingsView({ searchQuery }: { searchQuery: string }) {
  const navigate = useNavigate();
  const { phoneNumber } = useParams<{ phoneNumber: string }>();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const decodedNumber = phoneNumber ? decodeURIComponent(phoneNumber) : undefined;

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (decodedNumber) params.phone_number = decodedNumber;
    if (searchQuery) params.search = searchQuery;

    api.getRecordings(params)
      .then(data => {
        setRecordings(data.recordings);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [decodedNumber, searchQuery]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const statusChip = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: 'var(--gray-200)', color: 'var(--gray-600)', label: 'Pending' },
      processing: { bg: '#dbeafe', color: '#1d4ed8', label: 'Processing' },
      completed: { bg: '#dcfce7', color: '#16a34a', label: 'Completed' },
      failed: { bg: '#fee2e2', color: '#dc2626', label: 'Failed' },
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px',
        borderRadius: '10px', background: s.bg, color: s.color,
      }}>
        {status === 'processing' && <Loader2 size={12} className="spin" />}
        {status === 'failed' && <AlertCircle size={12} />}
        {s.label}
      </span>
    );
  };

  if (loading) return <div className="loading">Loading recordings...</div>;

  if (recordings.length === 0) {
    return (
      <div className="empty-state">
        <PhoneIncoming size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
        <h3>No recordings yet</h3>
        <p style={{ marginTop: '0.5rem' }}>
          {decodedNumber
            ? `No recordings found for ${decodedNumber}`
            : searchQuery
              ? 'No recordings match your search'
              : 'Recordings from the CallScribe Android app will appear here'}
        </p>
      </div>
    );
  }

  return (
    <div className="recordings-view">
      <div className="view-header">
        <h2 className="view-title">
          {decodedNumber ? `Recordings: ${decodedNumber}` : 'All Recordings'}
        </h2>
        <span className="view-count">{total} recording{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="recordings-list">
        {recordings.map(rec => (
          <div
            key={rec.id}
            className="recording-card"
            onClick={() => navigate(`/recording/${rec.id}`)}
          >
            <div className="recording-card-icon">
              {rec.direction === 'incoming'
                ? <PhoneIncoming size={20} />
                : <PhoneOutgoing size={20} />}
            </div>

            <div className="recording-card-info">
              <div className="recording-card-primary">
                <span className="recording-phone">{rec.phone_number}</span>
                <span className="recording-direction">{rec.direction}</span>
              </div>
              <div className="recording-card-secondary">
                <span>{formatDate(rec.started_at)} at {formatTime(rec.started_at)}</span>
                <span className="recording-duration">
                  <Clock size={12} /> {formatDuration(rec.duration_seconds)}
                </span>
              </div>
            </div>

            <div className="recording-card-status">
              {statusChip(rec.transcript_status)}
              <div className="recording-card-icons">
                {rec.email_sent && <Mail size={14} style={{ color: 'var(--gray-400)' }} title="Email sent" />}
                {rec.has_notes && <MessageSquare size={14} style={{ color: 'var(--primary)' }} title="Has notes" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
