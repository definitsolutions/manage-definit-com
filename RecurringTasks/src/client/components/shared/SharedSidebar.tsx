import React, { useState, useEffect, useRef } from 'react';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface AppInfo {
  slug: string;
  name: string;
  iconEmoji: string | null;
  iconUrl?: string | null;
  basePath?: string;
}

export interface SharedSidebarProps {
  /** Navigation items - can be flat array or sections */
  navigation: (NavItem | NavSection)[];
  /** Current active path */
  activePath: string;
  /** Callback when a nav item is clicked */
  onNavigate: (path: string) => void;
  /** Current app slug (for filtering app selector) */
  currentAppSlug: string;
  /** List of available apps for app selector */
  apps: AppInfo[];
  /** User email for bug report */
  userEmail?: string;
  /** User display name for bug report */
  userName?: string;
  /** Container name for bug report */
  containerName: string;
  /** Whether sidebar is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Portal home URL (default: /) */
  portalHomeUrl?: string;
}

const emojiMap: Record<string, string> = {
  rocket: '\u{1F680}',
  shield: '\u{1F6E1}',
  chart: '\u{1F4CA}',
  gear: '\u2699\uFE0F',
  folder: '\u{1F4C1}',
  users: '\u{1F465}',
  mail: '\u{1F4E7}',
  database: '\u{1F5C4}',
  cloud: '\u2601\uFE0F',
  lock: '\u{1F512}',
  bug: '\u{1F41B}',
  key: '\u{1F511}',
  book: '\u{1F4D6}',
  ticket: '\u{1F3AB}',
  map: '\u{1F5FA}',
  plug: '\u{1F50C}',
  palette: '\u{1F3A8}',
  calendar: '\u{1F4C5}',
  clock: '\u{1F552}',
  bee: '\u{1F41D}',
};

function isNavSection(item: NavItem | NavSection): item is NavSection {
  return 'title' in item && 'items' in item;
}

export default function SharedSidebar({
  navigation,
  activePath,
  onNavigate,
  currentAppSlug,
  apps,
  userEmail,
  userName,
  containerName,
  collapsed = false,
  onCollapseChange,
  portalHomeUrl = '/',
}: SharedSidebarProps) {
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null);
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null);
  const [logoMarkUrl, setLogoMarkUrl] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [showAppSelector, setShowAppSelector] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const appSelectorRef = useRef<HTMLDivElement>(null);

  // Determine which logo to use based on theme
  const logoUrl = currentTheme === 'dark' && logoDarkUrl ? logoDarkUrl : logoLightUrl;

  // Fetch branding logos from config
  useEffect(() => {
    fetch('/tasks/api/branding/config')
      .then(res => res.json())
      .then(data => {
        // Set full logo URLs (light and dark)
        if (data.logoLight) {
          setLogoLightUrl(data.logoLight);
        }
        if (data.logoDark) {
          setLogoDarkUrl(data.logoDark);
        }
        // Set logo mark URL (for collapsed sidebar)
        if (data.logoMark) {
          setLogoMarkUrl(data.logoMark);
        }
      })
      .catch(() => {
        setLogoLightUrl(null);
        setLogoDarkUrl(null);
        setLogoMarkUrl(null);
      });
  }, []);

  // Detect theme changes from DOM
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setCurrentTheme(theme === 'dark' ? 'dark' : 'light');
    };

    // Initial check
    checkTheme();

    // Watch for attribute changes on documentElement
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  // Close app selector on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (appSelectorRef.current && !appSelectorRef.current.contains(e.target as Node)) {
        setShowAppSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const otherApps = apps.filter(app => app.slug !== currentAppSlug);
  const currentApp = apps.find(app => app.slug === currentAppSlug);

  const getEmojiIcon = (emoji: string | null): string => {
    if (!emoji) return emojiMap.gear;
    return emojiMap[emoji] || emoji;
  };

  const renderAppIcon = (app: AppInfo, className?: string) => {
    if (app.iconUrl) {
      return <img src={app.iconUrl} alt={app.name} className={`sidebar-app-icon-img ${className || ''}`} />;
    }
    return <span className={className}>{getEmojiIcon(app.iconEmoji)}</span>;
  };

  const handleToggleCollapse = () => {
    onCollapseChange?.(!collapsed);
  };

  const captureScreenshot = async () => {
    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        scale: 0.5,
        ignoreElements: (el) => el.classList.contains('shared-sidebar') || el.classList.contains('bug-report-modal'),
      });
      setScreenshot(canvas.toDataURL('image/png'));
      setShowBugModal(true);
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
      setShowBugModal(true);
    } finally {
      setCapturing(false);
    }
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = activePath === item.path ||
      (item.path !== '/' && activePath.startsWith(item.path));

    return (
      <li key={item.path}>
        <button
          className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
          onClick={() => onNavigate(item.path)}
          title={collapsed ? item.label : undefined}
        >
          <span className="nav-icon">{item.icon}</span>
          {!collapsed && <span className="nav-label">{item.label}</span>}
        </button>
      </li>
    );
  };

  return (
    <>
      <nav className={`shared-sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Header with Logo */}
        <div className="sidebar-header">
          <a href={portalHomeUrl} className="sidebar-logo" title="Go to Portal">
            {collapsed ? (
              logoMarkUrl ? (
                <img src={logoMarkUrl} alt="Logo" className="logo-mark" />
              ) : (
                <div className="logo-placeholder">D</div>
              )
            ) : (
              logoUrl ? (
                <img src={logoUrl} alt="DefinIT" className="logo-full" />
              ) : (
                <div className="logo-text">DefinIT</div>
              )
            )}
          </a>
        </div>

        {/* App Selector */}
        {!collapsed && apps.length > 0 && (
          <div className="sidebar-app-selector" ref={appSelectorRef}>
            <button
              className="app-selector-btn"
              onClick={() => setShowAppSelector(!showAppSelector)}
            >
              <span className="app-icon">{currentApp ? renderAppIcon(currentApp) : emojiMap.rocket}</span>
              <span className="app-name">{currentApp?.name || 'Apps'}</span>
              <span className="dropdown-arrow">{showAppSelector ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showAppSelector && otherApps.length > 0 && (
              <div className="app-dropdown">
                {otherApps.map(app => (
                  <a key={app.slug} href={app.basePath || `/apps/${app.slug}`} className="app-dropdown-item">
                    <span className="app-emoji">{renderAppIcon(app)}</span>
                    <span>{app.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="sidebar-divider"></div>

        {/* Navigation */}
        <div className="sidebar-nav">
          {navigation.map((item, index) => {
            if (isNavSection(item)) {
              return (
                <div key={item.title} className="nav-section">
                  {!collapsed && <div className="nav-section-title">{item.title}</div>}
                  <ul className="nav-list">
                    {item.items.map(navItem => renderNavItem(navItem))}
                  </ul>
                </div>
              );
            } else {
              return (
                <ul key={item.path} className="nav-list">
                  {renderNavItem(item)}
                </ul>
              );
            }
          })}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <a
            href="https://docs.definit.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="bug-report-sidebar-btn"
            title="Hudu IT Docs"
          >
            {collapsed ? (
              <span className="bug-icon">{'\uD83D\uDCD6'}</span>
            ) : (
              <>
                <span className="bug-icon">{'\uD83D\uDCD6'}</span>
                <span className="bug-label">Hudu Docs</span>
              </>
            )}
          </a>
          <button
            className={`bug-report-sidebar-btn ${capturing ? 'capturing' : ''}`}
            onClick={captureScreenshot}
            disabled={capturing}
            title="Report a Bug"
          >
            {collapsed ? (
              <span className="bug-icon">{'\uD83D\uDC1B'}</span>
            ) : (
              <>
                <span className="bug-icon">{'\uD83D\uDC1B'}</span>
                <span className="bug-label">Report Bug</span>
              </>
            )}
          </button>
        </div>

        {/* Collapse Toggle */}
        <button
          className="sidebar-collapse-toggle"
          onClick={handleToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u00BB' : '\u00AB'}
        </button>
      </nav>

      {/* Bug Report Modal */}
      {showBugModal && (
        <BugReportModal
          screenshot={screenshot}
          containerName={containerName}
          userEmail={userEmail}
          userName={userName}
          onClose={() => {
            setShowBugModal(false);
            setScreenshot(null);
          }}
        />
      )}
    </>
  );
}

// Bug Report Modal Component
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
    if (window.location.pathname.startsWith('/apps/')) {
      return '/api/apps/bug-report/reports';
    }
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
        throw new Error(data.error || 'Failed to submit bug report');
      }

      const data = await response.json();
      setTicketNumber(data.ticketNumber || data.reportNumber);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bug report');
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
                <p>Your report has been created as Ticket #{ticketNumber}</p>
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
                  <img src={screenshot} alt="Screenshot preview" />
                  <p>Screenshot captured</p>
                </div>
              )}

              {error && (
                <div className="alert alert-error">{error}</div>
              )}

              <div className="form-group">
                <label>Issue Type *</label>
                <select
                  value={formData.issueType}
                  onChange={e => setFormData({ ...formData, issueType: e.target.value as any })}
                  required
                >
                  <option value="Bug">Bug</option>
                  <option value="FeatureRequest">Feature Request</option>
                  <option value="Question">Question</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Urgency *</label>
                <select
                  value={formData.urgency}
                  onChange={e => setFormData({ ...formData, urgency: e.target.value as any })}
                  required
                >
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
                  placeholder="Please describe the issue in detail..."
                  required
                />
                <div className={`word-count ${isValidWordCount ? 'valid' : 'invalid'}`}>
                  {wordCount} words
                </div>
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
