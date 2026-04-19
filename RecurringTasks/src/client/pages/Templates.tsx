import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Template {
  id: string;
  title: string;
  description: string | null;
  cadence: string;
  recurrenceRule: any;
  proofRequired: boolean;
  sopUrl: string | null;
  active: boolean;
  defaultOwner: { id: string; displayName: string } | null;
  createdBy: { id: string; displayName: string };
  _count: { taskInstances: number };
}

interface Department {
  id: string;
  name: string;
  role: string;
}

export default function Templates() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  useEffect(() => {
    api.getDepartments().then((data) => {
      setDepartments(data.departments);
      if (data.departments.length > 0) setSelectedDept(data.departments[0].id);
      setLoading(false);
    });
  }, []);

  const fetchTemplates = () => {
    if (!selectedDept) return;
    api.getTemplates({ departmentId: selectedDept }).then((data) => {
      setTemplates(data.templates);
    });
  };

  useEffect(fetchTemplates, [selectedDept]);

  const handleToggleActive = async (id: string, active: boolean) => {
    await api.updateTemplate(id, { active: !active });
    fetchTemplates();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMessage('');
    try {
      const result = await api.triggerGeneration();
      setGenMessage(`Generated ${result.created} tasks, skipped ${result.skipped} duplicates.`);
    } catch {
      setGenMessage('Generation failed.');
    }
    setGenerating(false);
  };

  const handleCreateTemplate = async (data: any) => {
    await api.createTemplate({ ...data, departmentId: selectedDept });
    setShowCreateModal(false);
    fetchTemplates();
  };

  const handleUpdateTemplate = async (data: any) => {
    if (!editingTemplate) return;
    await api.updateTemplate(editingTemplate.id, data);
    setEditingTemplate(null);
    fetchTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    await api.deleteTemplate(id);
    setEditingTemplate(null);
    fetchTemplates();
  };

  const currentDept = departments.find((d) => d.id === selectedDept);
  const isManager = currentDept?.role === 'manager' || currentDept?.role === 'admin';

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="templates-page">
      <div className="page-header">
        <h1>Templates</h1>
        <div className="header-actions">
          <select className="dept-selector" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {isManager && (
            <>
              <button className="btn btn-outline" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating...' : 'Generate Now'}
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>New Template</button>
            </>
          )}
        </div>
      </div>

      {genMessage && <div className="alert alert-info">{genMessage}</div>}

      {templates.length === 0 ? (
        <div className="empty-state">
          <p>No templates for this department yet.</p>
        </div>
      ) : (
        <div className="template-grid">
          {templates.map((t) => (
            <div key={t.id} className={`template-card ${!t.active ? 'inactive' : ''}`}>
              <div className="template-header">
                <h3>{t.title}</h3>
                {isManager && (
                  <div className="template-actions">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => setEditingTemplate(t)}
                      title="Edit template"
                    >
                      Edit
                    </button>
                    <button
                      className={`toggle-btn ${t.active ? 'active' : ''}`}
                      onClick={() => handleToggleActive(t.id, t.active)}
                      title={t.active ? 'Deactivate' : 'Activate'}
                    >
                      {t.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                )}
              </div>
              {t.description && <p className="template-desc">{t.description}</p>}
              <div className="template-meta">
                <span className="cadence-badge">{t.cadence}</span>
                {t.proofRequired && <span className="proof-badge">proof required</span>}
              </div>
              <div className="template-details">
                <div>Owner: {t.defaultOwner?.displayName || 'None'}</div>
                <div>Tasks: {t._count.taskInstances}</div>
                {t.sopUrl && <div><a href={t.sopUrl} target="_blank" rel="noopener noreferrer">SOP Link</a></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <TemplateFormModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTemplate}
        />
      )}

      {editingTemplate && (
        <TemplateFormModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSubmit={handleUpdateTemplate}
          onDelete={handleDeleteTemplate}
        />
      )}
    </div>
  );
}

function parseRecurrenceRule(template: Template) {
  const rule = template.recurrenceRule || {};
  const cadence = template.cadence;

  let ruleType = 'dayOfMonth';
  let dayOfMonth = 1;
  let weekday = 0;
  let month = 1;
  let day = 1;
  let businessDaysOnly = true;
  let quarterMonths = [3, 6, 9, 12];
  let useCustomQuarterMonths = false;

  if (cadence === 'daily') {
    businessDaysOnly = rule.businessDaysOnly !== false;
  } else if (cadence === 'weekly') {
    weekday = rule.weekday ?? 0;
  } else if (cadence === 'annual') {
    if (rule.month && rule.day) {
      month = rule.month;
      day = rule.day;
    } else if (rule.nthWeekday) {
      month = rule.nthWeekday.month ?? 1;
    }
  } else {
    // monthly or quarterly
    if (rule.lastBusinessDay) {
      ruleType = 'lastBusinessDay';
    } else if (rule.nthWeekday) {
      ruleType = 'dayOfMonth'; // simplified - nthWeekday shown as dayOfMonth for now
      dayOfMonth = rule.nthWeekday.n ?? 1;
    } else if (rule.dayOfMonth) {
      ruleType = 'dayOfMonth';
      dayOfMonth = rule.dayOfMonth;
    }

    if (cadence === 'quarterly' && rule.months && Array.isArray(rule.months)) {
      quarterMonths = rule.months;
      useCustomQuarterMonths = true;
    }
  }

  return { ruleType, dayOfMonth, weekday, month, day, businessDaysOnly, quarterMonths, useCustomQuarterMonths };
}

interface TemplateFormModalProps {
  template?: Template;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onDelete?: (id: string) => void;
}

function TemplateFormModal({ template, onClose, onSubmit, onDelete }: TemplateFormModalProps) {
  const isEdit = !!template;
  const parsed = template ? parseRecurrenceRule(template) : null;

  const [title, setTitle] = useState(template?.title || '');
  const [description, setDescription] = useState(template?.description || '');
  const [cadence, setCadence] = useState(template?.cadence || 'monthly');
  const [ruleType, setRuleType] = useState(parsed?.ruleType || 'dayOfMonth');
  const [dayOfMonth, setDayOfMonth] = useState(parsed?.dayOfMonth || 1);
  const [weekday, setWeekday] = useState(parsed?.weekday || 0);
  const [month, setMonth] = useState(parsed?.month || 1);
  const [day, setDay] = useState(parsed?.day || 1);
  const [businessDaysOnly, setBusinessDaysOnly] = useState(parsed?.businessDaysOnly ?? true);
  const [quarterMonths, setQuarterMonths] = useState<number[]>(parsed?.quarterMonths || [3, 6, 9, 12]);
  const [useCustomQuarterMonths, setUseCustomQuarterMonths] = useState(parsed?.useCustomQuarterMonths || false);
  const [proofRequired, setProofRequired] = useState(template?.proofRequired ?? false);
  const [sopUrl, setSopUrl] = useState(template?.sopUrl || '');
  const [active, setActive] = useState(template?.active ?? true);
  const [submitting, setSubmitting] = useState(false);

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const toggleQuarterMonth = (m: number) => {
    setQuarterMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  };

  const buildRecurrenceRule = () => {
    if (cadence === 'daily') return { businessDaysOnly };
    if (cadence === 'weekly') return { weekday };
    if (cadence === 'quarterly') {
      const base = ruleType === 'lastBusinessDay' ? { lastBusinessDay: true } : { dayOfMonth };
      if (useCustomQuarterMonths && quarterMonths.length > 0) return { ...base, months: quarterMonths };
      return base;
    }
    if (ruleType === 'dayOfMonth') return { dayOfMonth };
    if (ruleType === 'lastBusinessDay') return { lastBusinessDay: true };
    if (cadence === 'annual') return { month, day };
    return { dayOfMonth };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const data: any = {
      title,
      description: description || null,
      cadence,
      recurrenceRule: buildRecurrenceRule(),
      proofRequired,
      sopUrl: sopUrl || null,
    };
    if (isEdit) {
      data.active = active;
    }
    await onSubmit(data);
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Template' : 'Create Template'}</h3>
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
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Cadence *</label>
                <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              {cadence === 'daily' && (
                <div className="form-group checkbox-group">
                  <label>
                    <input type="checkbox" checked={businessDaysOnly} onChange={(e) => setBusinessDaysOnly(e.target.checked)} />
                    Business days only (Mon-Fri)
                  </label>
                </div>
              )}
              {cadence === 'weekly' && (
                <div className="form-group">
                  <label>Weekday</label>
                  <select value={weekday} onChange={(e) => setWeekday(parseInt(e.target.value))}>
                    {weekdays.map((w, i) => <option key={i} value={i}>{w}</option>)}
                  </select>
                </div>
              )}
              {(cadence === 'monthly' || cadence === 'quarterly') && (
                <>
                  <div className="form-group">
                    <label>Rule Type</label>
                    <select value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
                      <option value="dayOfMonth">Day of Month</option>
                      <option value="lastBusinessDay">Last Business Day</option>
                    </select>
                  </div>
                  {ruleType === 'dayOfMonth' && (
                    <div className="form-group">
                      <label>Day</label>
                      <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value))} />
                    </div>
                  )}
                </>
              )}
              {cadence === 'quarterly' && (
                <div className="form-group">
                  <label>
                    <input type="checkbox" checked={useCustomQuarterMonths} onChange={(e) => setUseCustomQuarterMonths(e.target.checked)} />
                    {' '}Custom quarter months (default: Mar/Jun/Sep/Dec)
                  </label>
                  {useCustomQuarterMonths && (
                    <div className="quarter-months-grid">
                      {months.map((m, i) => (
                        <label key={i} className="quarter-month-option">
                          <input type="checkbox" checked={quarterMonths.includes(i + 1)} onChange={() => toggleQuarterMonth(i + 1)} />
                          {m.slice(0, 3)}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {cadence === 'annual' && (
                <>
                  <div className="form-group">
                    <label>Month</label>
                    <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                      {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Day</label>
                    <input type="number" min={1} max={31} value={day} onChange={(e) => setDay(parseInt(e.target.value))} />
                  </div>
                </>
              )}
            </div>
            <div className="form-row">
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" checked={proofRequired} onChange={(e) => setProofRequired(e.target.checked)} />
                  Proof Required
                </label>
              </div>
              {isEdit && (
                <div className="form-group checkbox-group">
                  <label>
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                    Active
                  </label>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>SOP URL</label>
              <input type="url" value={sopUrl} onChange={(e) => setSopUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="modal-footer">
            {isEdit && onDelete && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={submitting}
                onClick={() => {
                  if (window.confirm(`Delete "${template!.title}"? This will also remove all not-started task instances.`)) {
                    onDelete(template!.id);
                  }
                }}
              >
                Delete
              </button>
            )}
            <div className="modal-footer-right">
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !title}>
                {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
