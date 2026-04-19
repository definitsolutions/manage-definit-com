import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Department {
  id: string;
  name: string;
  role: string;
  memberCount: number;
  templateCount: number;
  taskCount: number;
}

interface Member {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDepartments().then((data) => {
      setDepartments(data.departments);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedDept) {
      setMembers([]);
      return;
    }

    const API_BASE = "/api";

    fetch(`${API_BASE}/departments/${selectedDept}/members`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setMembers(data.members || []))
      .catch(() => setMembers([]));
  }, [selectedDept]);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="departments-page">
      <div className="page-header">
        <h1>Departments</h1>
      </div>

      <div className="dept-grid">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className={`dept-card ${selectedDept === dept.id ? 'selected' : ''}`}
            onClick={() => setSelectedDept(selectedDept === dept.id ? null : dept.id)}
          >
            <h3>{dept.name}</h3>
            <div className="dept-meta">
              <span>Your role: <strong>{dept.role}</strong></span>
            </div>
            <div className="dept-stats">
              <div className="dept-stat">
                <div className="dept-stat-value">{dept.memberCount}</div>
                <div className="dept-stat-label">Members</div>
              </div>
              <div className="dept-stat">
                <div className="dept-stat-value">{dept.templateCount}</div>
                <div className="dept-stat-label">Templates</div>
              </div>
              <div className="dept-stat">
                <div className="dept-stat-value">{dept.taskCount}</div>
                <div className="dept-stat-label">Tasks</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedDept && members.length > 0 && (
        <div className="section">
          <h2>Members</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.displayName}</td>
                  <td>{m.email}</td>
                  <td><span className={`role-badge role-${m.role}`}>{m.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {departments.length === 0 && (
        <div className="empty-state">
          <p>You are not a member of any departments.</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginTop: '0.5rem' }}>
            Contact an administrator to be added to a department.
          </p>
        </div>
      )}
    </div>
  );
}
