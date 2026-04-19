import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface Department {
  id: string;
  name: string;
  role: string;
  memberCount: number;
  templateCount: number;
  taskCount: number;
}

interface Task {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  proofRequired: boolean;
  department?: { id: string; name: string };
  owner?: { id: string; displayName: string } | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({ total: 0, notStarted: 0, inProgress: 0, blocked: 0, done: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDepartments().then((data) => {
      setDepartments(data.departments);
      if (data.departments.length > 0) {
        setSelectedDept(data.departments[0].id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedDept) return;

    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    api.getTasks({
      departmentId: selectedDept,
      from: now.toISOString(),
      to: weekLater.toISOString(),
      limit: '20',
    }).then((data) => {
      setUpcomingTasks(data.tasks);
    }).catch(() => {});

    // Get stats for all statuses
    Promise.all([
      api.getTasks({ departmentId: selectedDept, limit: '1' }),
      api.getTasks({ departmentId: selectedDept, status: 'not_started', limit: '1' }),
      api.getTasks({ departmentId: selectedDept, status: 'in_progress', limit: '1' }),
      api.getTasks({ departmentId: selectedDept, status: 'blocked', limit: '1' }),
      api.getTasks({ departmentId: selectedDept, status: 'done', limit: '1' }),
    ]).then(([all, ns, ip, bl, dn]) => {
      setStats({
        total: all.total,
        notStarted: ns.total,
        inProgress: ip.total,
        blocked: bl.total,
        done: dn.total,
      });
    }).catch(() => {});
  }, [selectedDept]);

  if (loading) return <div className="loading">Loading...</div>;

  if (departments.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Departments</h2>
        <p>You are not a member of any departments yet.</p>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginTop: '0.5rem' }}>
          An administrator needs to add you to a department before you can view and manage tasks.
        </p>
        <a href="/" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Back to Dashboard
        </a>
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'not_started': return 'var(--color-gray)';
      case 'in_progress': return 'var(--color-blue)';
      case 'blocked': return 'var(--color-red)';
      case 'done': return 'var(--color-green)';
      default: return 'var(--color-gray)';
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <select
          className="dept-selector"
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card stat-not-started">
          <div className="stat-value">{stats.notStarted}</div>
          <div className="stat-label">Not Started</div>
        </div>
        <div className="stat-card stat-in-progress">
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card stat-blocked">
          <div className="stat-value">{stats.blocked}</div>
          <div className="stat-label">Blocked</div>
        </div>
        <div className="stat-card stat-done">
          <div className="stat-value">{stats.done}</div>
          <div className="stat-label">Done</div>
        </div>
      </div>

      <div className="section">
        <h2>Upcoming Tasks (Next 7 Days)</h2>
        {upcomingTasks.length === 0 ? (
          <p className="empty-message">No upcoming tasks this week.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Proof</th>
              </tr>
            </thead>
            <tbody>
              {upcomingTasks.map((task) => (
                <tr key={task.id} onClick={() => navigate(`/tasks/${task.id}`)} className="clickable-row">
                  <td>{task.title}</td>
                  <td>{formatDate(task.dueDate)}</td>
                  <td>
                    <span className="status-badge" style={{ backgroundColor: statusColor(task.status) }}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{task.owner?.displayName || '-'}</td>
                  <td>{task.proofRequired ? 'Required' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
