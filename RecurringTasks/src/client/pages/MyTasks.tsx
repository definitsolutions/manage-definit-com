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
  department?: { id: string; name: string };
  owner?: { id: string; displayName: string } | null;
}

export default function MyTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTasks = () => {
    const params: Record<string, string> = { limit: '100' };
    if (statusFilter) params.status = statusFilter;
    api.getMyTasks(params).then((data) => {
      setTasks(data.tasks);
      setTotal(data.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter]);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter]);

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

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'done') return false;
    return new Date(dueDate) < new Date();
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
      fetchTasks();
    } catch (err) {
      alert('Failed to delete tasks');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  // Group by department
  const grouped = tasks.reduce((acc, task) => {
    const deptName = task.department?.name || 'Unknown';
    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="my-tasks-page">
      <div className="page-header">
        <h1>My Tasks</h1>
        <div className="header-actions">
          <select className="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      <div className="task-count">{total} task{total !== 1 ? 's' : ''} assigned to you</div>

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

      {Object.entries(grouped).map(([deptName, deptTasks]) => (
        <div key={deptName} className="section">
          <h2>{deptName}</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    checked={deptTasks.length > 0 && deptTasks.every(t => selectedIds.has(t.id))}
                    onChange={() => {
                      const allSelected = deptTasks.every(t => selectedIds.has(t.id));
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        deptTasks.forEach(t => allSelected ? next.delete(t.id) : next.add(t.id));
                        return next;
                      });
                    }}
                  />
                </th>
                <th>Title</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Proof</th>
              </tr>
            </thead>
            <tbody>
              {deptTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className={`clickable-row ${isOverdue(task.dueDate, task.status) ? 'overdue-row' : ''} ${selectedIds.has(task.id) ? 'selected-row' : ''}`}
                >
                  <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={() => toggleSelect(task.id)}
                    />
                  </td>
                  <td>{task.title}</td>
                  <td className={isOverdue(task.dueDate, task.status) ? 'overdue' : ''}>{formatDate(task.dueDate)}</td>
                  <td>
                    <span className="status-badge" style={{ backgroundColor: statusColor(task.status) }}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{task.proofRequired ? (task.proofLink ? 'Provided' : 'Required') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {tasks.length === 0 && (
        <div className="empty-state">
          <p>No tasks assigned to you{statusFilter ? ` with status "${statusFilter.replace('_', ' ')}"` : ''}.</p>
        </div>
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
