import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: string;
  proofRequired: boolean;
  proofLink: string | null;
  completionNote: string | null;
  sopUrl: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cadence: string | null;
  owner: { id: string; displayName: string; email: string } | null;
  backupOwner: { id: string; displayName: string; email: string } | null;
  department: { id: string; name: string };
  template: { id: string; title: string } | null;
  createdBy: { id: string; displayName: string };
  updatedBy: { id: string; displayName: string };
}

interface AuditEntry {
  id: string;
  action: string;
  changedFields: Record<string, { old: unknown; new: unknown }> | null;
  createdAt: string;
  actor: { id: string; displayName: string };
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchTask = () => {
    if (!id) return;
    api.getTask(id).then((data) => {
      setTask(data.task);
      setAuditLogs(data.auditLogs || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(fetchTask, [id]);

  const handleComplete = async (proofLink: string, completionNote: string) => {
    if (!id) return;
    await api.completeTask(id, { proofLink, completionNote });
    setShowCompleteModal(false);
    fetchTask();
  };

  const handleReopen = async () => {
    if (!id) return;
    await api.reopenTask(id);
    fetchTask();
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    await api.updateTask(id, { status: newStatus });
    fetchTask();
  };

  const handleEditSave = async (data: Record<string, unknown>) => {
    if (!id) return;
    await api.updateTask(id, data);
    setShowEditModal(false);
    fetchTask();
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!task) return <div className="empty-state"><p>Task not found.</p></div>;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDateTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const isOverdue = task.status !== 'done' && new Date(task.dueDate) < new Date();

  return (
    <div className="task-detail">
      <button className="btn btn-outline back-btn" onClick={() => navigate(-1)}>Back</button>

      <div className="detail-header">
        <div>
          <h1>{task.title}</h1>
          <div className="detail-meta">
            <span className="dept-badge">{task.department.name}</span>
            {task.cadence && <span className="cadence-badge">{task.cadence}</span>}
            {task.template && <span className="recurring-badge">from template</span>}
          </div>
        </div>
        <div className="detail-actions">
          <button className="btn btn-outline" onClick={() => setShowEditModal(true)}>Edit</button>
          {task.status !== 'done' && (
            <>
              {task.status === 'not_started' && (
                <button className="btn btn-primary" onClick={() => handleStatusChange('in_progress')}>Start</button>
              )}
              {task.status === 'in_progress' && (
                <button className="btn btn-warning" onClick={() => handleStatusChange('blocked')}>Mark Blocked</button>
              )}
              {task.status === 'blocked' && (
                <button className="btn btn-primary" onClick={() => handleStatusChange('in_progress')}>Unblock</button>
              )}
              <button className="btn btn-success" onClick={() => setShowCompleteModal(true)}>Complete</button>
            </>
          )}
          {task.status === 'done' && (
            <button className="btn btn-outline" onClick={handleReopen}>Reopen</button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h3>Details</h3>
          <div className="detail-field">
            <label>Status</label>
            <span className={`status-text ${task.status}`}>{task.status.replace('_', ' ')}</span>
          </div>
          <div className="detail-field">
            <label>Due Date</label>
            <span className={isOverdue ? 'overdue' : ''}>{formatDate(task.dueDate)}</span>
          </div>
          {task.description && (
            <div className="detail-field">
              <label>Description</label>
              <p>{task.description}</p>
            </div>
          )}
          {task.sopUrl && (
            <div className="detail-field">
              <label>SOP</label>
              <a href={task.sopUrl} target="_blank" rel="noopener noreferrer">{task.sopUrl}</a>
            </div>
          )}
        </div>

        <div className="detail-card">
          <h3>People</h3>
          <div className="detail-field">
            <label>Owner</label>
            <span>{task.owner?.displayName || 'Unassigned'}</span>
          </div>
          <div className="detail-field">
            <label>Backup Owner</label>
            <span>{task.backupOwner?.displayName || 'None'}</span>
          </div>
          <div className="detail-field">
            <label>Created By</label>
            <span>{task.createdBy.displayName}</span>
          </div>
        </div>

        <div className="detail-card">
          <h3>Completion</h3>
          <div className="detail-field">
            <label>Proof Required</label>
            <span>{task.proofRequired ? 'Yes' : 'No'}</span>
          </div>
          {task.proofLink && (
            <div className="detail-field">
              <label>Proof Link</label>
              <a href={task.proofLink} target="_blank" rel="noopener noreferrer">{task.proofLink}</a>
            </div>
          )}
          {task.completionNote && (
            <div className="detail-field">
              <label>Completion Note</label>
              <p>{task.completionNote}</p>
            </div>
          )}
          {task.completedAt && (
            <div className="detail-field">
              <label>Completed At</label>
              <span>{formatDateTime(task.completedAt)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <h2>Audit Log</h2>
        {auditLogs.length === 0 ? (
          <p className="empty-message">No audit entries yet.</p>
        ) : (
          <div className="audit-log">
            {auditLogs.map((entry) => (
              <div key={entry.id} className="audit-entry">
                <div className="audit-header">
                  <strong>{entry.actor.displayName}</strong>
                  <span className={`action-badge action-${entry.action}`}>{entry.action}</span>
                  <span className="audit-time">{formatDateTime(entry.createdAt)}</span>
                </div>
                {entry.changedFields && (
                  <div className="audit-changes">
                    {Object.entries(entry.changedFields).map(([field, change]) => (
                      <div key={field} className="audit-change">
                        <span className="field-name">{field}</span>:
                        <span className="old-value">{String(change.old ?? 'null')}</span>
                        {' -> '}
                        <span className="new-value">{String(change.new ?? 'null')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCompleteModal && (
        <CompleteModal
          proofRequired={task.proofRequired}
          onClose={() => setShowCompleteModal(false)}
          onSubmit={handleComplete}
        />
      )}

      {showEditModal && (
        <EditTaskModal
          task={task}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSave}
        />
      )}
    </div>
  );
}

function CompleteModal({ proofRequired, onClose, onSubmit }: {
  proofRequired: boolean;
  onClose: () => void;
  onSubmit: (proofLink: string, completionNote: string) => void;
}) {
  const [proofLink, setProofLink] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(proofLink, completionNote);
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Complete Task</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {proofRequired && (
              <div className="form-group">
                <label>Proof Link *</label>
                <input
                  type="url"
                  value={proofLink}
                  onChange={(e) => setProofLink(e.target.value)}
                  placeholder="https://..."
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>Completion Note</label>
              <textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                rows={3}
                placeholder="Optional notes about completion..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={submitting || (proofRequired && !proofLink)}>
              {submitting ? 'Completing...' : 'Mark Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// EditTaskModal - Edit task details (title, description, due date, owner, etc.)
// =============================================================================
// 2026-02-18: Added edit modal to allow editing existing tasks (Bug #40)

interface DepartmentMember {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

function EditTaskModal({ task, onClose, onSubmit }: {
  task: TaskDetail;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [dueDate, setDueDate] = useState(task.dueDate.slice(0, 10));
  const [ownerId, setOwnerId] = useState(task.owner?.id || '');
  const [backupOwnerId, setBackupOwnerId] = useState(task.backupOwner?.id || '');
  const [proofRequired, setProofRequired] = useState(task.proofRequired);
  const [sopUrl, setSopUrl] = useState(task.sopUrl || '');
  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDepartmentMembers(task.department.id)
      .then((data) => setMembers(data.members || []))
      .catch(() => setMembers([]));
  }, [task.department.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        title,
        description: description || null,
        dueDate,
        ownerId: ownerId || null,
        backupOwnerId: backupOwnerId || null,
        proofRequired,
        sopUrl: sopUrl || null,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Task</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={proofRequired}
                    onChange={(e) => setProofRequired(e.target.checked)}
                  />
                  Proof Required
                </label>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Owner</label>
                <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Backup Owner</label>
                <select value={backupOwnerId} onChange={(e) => setBackupOwnerId(e.target.value)}>
                  <option value="">None</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>SOP URL</label>
              <input
                type="url"
                value={sopUrl}
                onChange={(e) => setSopUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !title || !dueDate}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
