import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface Task {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  proofRequired: boolean;
  proofLink?: string | null;
  owner?: { id: string; displayName: string; email: string } | null;
  template?: { id: string; title: string } | null;
}

interface Department {
  id: string;
  name: string;
  role: string;
}

export default function Tasks() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.getDepartments().then((data) => {
      setDepartments(data.departments);
      if (data.departments.length > 0) setSelectedDept(data.departments[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedDept) return;
    const params: Record<string, string> = { departmentId: selectedDept, page: String(page), limit: '50' };
    if (statusFilter) params.status = statusFilter;
    api.getTasks(params).then((data) => {
      setTasks(data.tasks);
      setTotal(data.total);
    });
  }, [selectedDept, statusFilter, page]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedDept, statusFilter, page]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const statusColor = (status: string) => {
    switch (status) {
      case 'not_started': return '#6b7280';
      case 'in_progress': return '#3b82f6';
      case 'blocked': return '#ef4444';
      case 'done': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      await api.bulkDeleteTasks([...selectedIds]);
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      const params: Record<string, string> = { departmentId: selectedDept, page: String(page), limit: '50' };
      if (statusFilter) params.status = statusFilter;
      const res = await api.getTasks(params);
      setTasks(res.tasks);
      setTotal(res.total);
    } catch (err) {
      alert('Failed to delete tasks');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateTask = async (data: any) => {
    await api.createTask({ ...data, departmentId: selectedDept });
    setShowCreateModal(false);
    // Refresh
    const params: Record<string, string> = { departmentId: selectedDept, page: '1', limit: '50' };
    if (statusFilter) params.status = statusFilter;
    const res = await api.getTasks(params);
    setTasks(res.tasks);
    setTotal(res.total);
    setPage(1);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tasks-page">
      <div className="page-header">
        <h1>All Tasks</h1>
        <div className="header-actions">
          <select className="dept-selector" value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setPage(1); }}>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="status-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>New Task</button>
        </div>
      </div>

      <div className="task-count">{total} task{total !== 1 ? 's' : ''}</div>

      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <span>{selectedIds.size} task{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>
            Delete Selected
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th className="checkbox-col">
              <input
                type="checkbox"
                checked={tasks.length > 0 && selectedIds.size === tasks.length}
                onChange={toggleSelectAll}
              />
            </th>
            <th>Title</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Proof</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              onClick={() => navigate(`/tasks/${task.id}`)}
              className={`clickable-row ${selectedIds.has(task.id) ? 'selected-row' : ''}`}
            >
              <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(task.id)}
                  onChange={() => toggleSelect(task.id)}
                />
              </td>
              <td>
                {task.title}
                {task.template && <span className="recurring-badge">recurring</span>}
              </td>
              <td>{formatDate(task.dueDate)}</td>
              <td>
                <span className="status-badge" style={{ backgroundColor: statusColor(task.status) }}>
                  {task.status.replace('_', ' ')}
                </span>
              </td>
              <td>{task.owner?.displayName || '-'}</td>
              <td>{task.proofRequired ? (task.proofLink ? 'Provided' : 'Required') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {total > 50 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {Math.ceil(total / 50)}</span>
          <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {showCreateModal && (
        <TaskCreateModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTask}
        />
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Tasks</h3>
              <button onClick={() => setShowDeleteConfirm(false)} className="close-btn" disabled={deleting}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete {selectedIds.size} task{selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <div></div>
              <div className="modal-footer-right">
                <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
                <button className="btn btn-danger" onClick={handleBulkDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : `Delete ${selectedIds.size} Task${selectedIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCreateModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [proofRequired, setProofRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ title, description, dueDate, proofRequired });
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Task</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="form-group">
              <label>Due Date *</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input type="checkbox" checked={proofRequired} onChange={(e) => setProofRequired(e.target.checked)} />
                Proof Required
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !title || !dueDate}>
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
