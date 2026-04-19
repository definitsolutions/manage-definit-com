// =============================================================================
// App.tsx - RecurringTasks main application component (Zendesk-style layout)
// 2026-02-20: Migrated from SharedSidebar+SharedHeader to Zendesk layout
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, User, RefreshCw, Users } from 'lucide-react';
import html2canvas from 'html2canvas';

import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import MyTasks from './pages/MyTasks';
import TaskDetail from './pages/TaskDetail';
import Templates from './pages/Templates';
import Departments from './pages/Departments';

import SharedIconRail from './components/shared/SharedIconRail';
import SharedContextPanel, { ContextPanelExpandButton, type NavItem, type NavSection } from './components/shared/SharedContextPanel';
import SharedTopBar, { type AppInfo } from './components/shared/SharedTopBar';

interface PortalUser {
  id: string;
  email: string;
  displayName: string;
  globalRole: string;
}

function isPortalMode(): boolean {
  if (typeof window === 'undefined') return false;
  return false;
}

function getPortalHomeUrl(): string {
  return '/';
}

const navigation: (NavItem | NavSection)[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { path: '/tasks', label: 'All Tasks', icon: <ClipboardList size={18} /> },
  { path: '/my-tasks', label: 'My Tasks', icon: <User size={18} /> },
  { path: '/templates', label: 'Templates', icon: <RefreshCw size={18} /> },
  { path: '/departments', label: 'Departments', icon: <Users size={18} /> },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const portalMode = isPortalMode();

  const [portalApps, setPortalApps] = useState<AppInfo[]>([]);
  const [user, setUser] = useState<PortalUser | null>(null);
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  // 2026-02-19: Unified theme — inline script in index.html sets data-theme before first paint
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Follow OS theme changes when user has no explicit preference saved
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (!localStorage.getItem('theme')) {
        const t = mq.matches ? 'dark' : 'light';
        setTheme(t);
        document.documentElement.setAttribute('data-theme', t);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    fetch('/tasks/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null));
  }, []);

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    if (portalMode) window.location.href = getPortalHomeUrl();
  };

  // Map current location to rail active item
  const getRailActiveId = (): string => {
    return 'recurring-tasks';
  };

  // Handle icon rail navigation (external = full page nav, internal = SPA)
  const handleRailNavigate = (path: string, external?: boolean) => {
    if (external) {
      window.location.href = path;
    } else {
      navigate(path);
    }
  };

  // Map portal apps to top bar format
  const topBarApps: AppInfo[] = portalApps.map((app: any) => ({
    slug: app.slug,
    name: app.name,
    iconEmoji: app.iconEmoji || null,
    iconUrl: app.iconUrl || null,
    basePath: app.basePath,
  }));

  // Capture screenshot for bug report
  const captureScreenshot = async () => {
    setCapturing(true);
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: 0.75,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      setScreenshot(dataUrl);
      setShowBugModal(true);
    } catch {
      setShowBugModal(true);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className={`zendesk-layout ${portalMode ? 'portal-mode' : ''}`}>
      <SharedIconRail
        activeId={getRailActiveId()}
        onNavigate={handleRailNavigate}
        onBugReport={captureScreenshot}
        onSettings={() => navigate('/departments')}
      />

      {!isMobile && (
        <>
          <SharedContextPanel
            title="Recurring Tasks"
            navigation={navigation}
            activePath={location.pathname}
            onNavigate={handleNavigate}
            collapsed={contextPanelCollapsed}
            onCollapseChange={setContextPanelCollapsed}
            onBugReport={captureScreenshot}
          />
          {contextPanelCollapsed && (
            <ContextPanelExpandButton onClick={() => setContextPanelCollapsed(false)} />
          )}
        </>
      )}

      <div className={`zendesk-main ${contextPanelCollapsed ? 'panel-collapsed' : ''} ${isMobile ? 'mobile' : ''}`}>
        <SharedTopBar
          currentAppName="Recurring Tasks"
          currentAppSlug="recurring-tasks"
          apps={topBarApps}
          user={user ? { email: user.email, displayName: user.displayName, globalRole: user.globalRole } : null}
          notifications={[]}
          theme={theme}
          onThemeToggle={toggleTheme}
          onLogout={handleLogout}
          searchPlaceholder="Search Tasks..."
          showMobileMenuButton={isMobile}
          onMobileMenuClick={() => {}}
          isMobile={isMobile}
        />

        <main className="zendesk-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/my-tasks" element={<MyTasks />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/departments" element={<Departments />} />
          </Routes>
        </main>
      </div>

      {showBugModal && (
        <BugReportModal
          screenshot={screenshot}
          containerName="Recurring Tasks"
          userEmail={user?.email}
          userName={user?.displayName || user?.email}
          onClose={() => { setShowBugModal(false); setScreenshot(null); }}
        />
      )}
    </div>
  );
}

// =============================================================================
// BugReportModal - Inline bug report modal component
// =============================================================================

interface BugReportModalProps {
  screenshot: string | null;
  containerName: string;
  userEmail?: string;
  userName?: string;
  onClose: () => void;
}

function BugReportModal({ screenshot, containerName, userEmail, userName, onClose }: BugReportModalProps) {
  const [formData, setFormData] = useState({
    issueType: 'Bug' as 'Bug' | 'FeatureRequest' | 'Question' | 'Other',
    urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordCount = formData.description.trim().split(/\s+/).filter(w => w.length > 0).length;
  const isValidWordCount = wordCount >= 1;

  const getBugReportApiUrl = () => {
    // standalone mode - no portal bug report endpoint
    return '/api/bugs/reports';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidWordCount) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(getBugReportApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          screenshot: screenshot || '',
          sourceUrl: window.location.href,
          sourceContainer: containerName,
          userEmail: userEmail || 'anonymous@unknown.local',
          userName: userName || 'Anonymous User',
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }
      const data = await response.json();
      setTicketNumber(data.ticketNumber || data.reportNumber);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bug-report-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Report a Bug</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        {success ? (
          <>
            <div className="modal-body">
              <div className="bug-report-success">
                <div className="success-icon">&#x2705;</div>
                <h4>Bug Report Submitted!</h4>
                <p>Ticket #{ticketNumber}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={onClose} className="btn btn-primary">Close</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {screenshot && (
                <div className="screenshot-preview-container">
                  <img src={screenshot} alt="Screenshot" />
                  <p>Screenshot captured</p>
                </div>
              )}
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>Issue Type *</label>
                <select value={formData.issueType} onChange={e => setFormData({ ...formData, issueType: e.target.value as any })} required>
                  <option value="Bug">Bug</option>
                  <option value="FeatureRequest">Feature Request</option>
                  <option value="Question">Question</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Urgency *</label>
                <select value={formData.urgency} onChange={e => setFormData({ ...formData, urgency: e.target.value as any })} required>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={6}
                  placeholder="Describe the issue..."
                  required
                />
                <div className={`word-count ${isValidWordCount ? 'valid' : 'invalid'}`}>{wordCount} words</div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
              <button type="submit" disabled={submitting || !isValidWordCount} className="btn btn-primary">
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
