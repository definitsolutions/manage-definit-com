// =============================================================================
// SharedContextPanel - Collapsible 260px navigation panel (Zendesk-style)
// =============================================================================

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Bug } from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface SharedContextPanelProps {
  /** Panel title (usually the current app name) */
  title: string;
  /** Navigation items - can be flat array or sections */
  navigation: (NavItem | NavSection)[];
  /** Current active path */
  activePath: string;
  /** Callback when a nav item is clicked */
  onNavigate: (path: string) => void;
  /** Whether panel is collapsed */
  collapsed: boolean;
  /** Callback when collapse state changes */
  onCollapseChange: (collapsed: boolean) => void;
  /** Callback for bug report button */
  onBugReport?: () => void;
}

function isNavSection(item: NavItem | NavSection): item is NavSection {
  return 'title' in item && 'items' in item;
}

export default function SharedContextPanel({
  title,
  navigation,
  activePath,
  onNavigate,
  collapsed,
  onCollapseChange,
  onBugReport,
}: SharedContextPanelProps) {

  const renderNavItem = (item: NavItem) => {
    const isActive = activePath === item.path ||
      (item.path !== '/' && activePath.startsWith(item.path));

    return (
      <li key={item.path}>
        <button
          className={`context-panel-nav-item ${isActive ? 'active' : ''}`}
          onClick={() => onNavigate(item.path)}
        >
          {item.icon && <span className="context-panel-nav-icon">{item.icon}</span>}
          <span className="context-panel-nav-label">{item.label}</span>
          {item.badge !== undefined && (
            <span className="context-panel-nav-badge">{item.badge}</span>
          )}
        </button>
      </li>
    );
  };

  if (collapsed) return null;

  return (
    <aside className="context-panel" role="complementary" aria-label="App navigation">
      {/* Panel header with title and collapse button */}
      <div className="context-panel-header">
        <h2 className="context-panel-title">{title}</h2>
        <button
          className="context-panel-collapse-btn"
          onClick={() => onCollapseChange(true)}
          title="Collapse panel"
          aria-label="Collapse navigation panel"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Navigation items */}
      <nav className="context-panel-nav">
        {navigation.map((item, index) => {
          if (isNavSection(item)) {
            return (
              <div key={item.title} className="context-panel-section">
                <div className="context-panel-section-title">{item.title}</div>
                <ul className="context-panel-list">
                  {item.items.map(navItem => renderNavItem(navItem))}
                </ul>
              </div>
            );
          }
          return (
            <ul key={item.path} className="context-panel-list">
              {renderNavItem(item)}
            </ul>
          );
        })}
      </nav>

      {/* Footer with bug report */}
      {onBugReport && (
        <div className="context-panel-footer">
          <button
            className="context-panel-bug-btn"
            onClick={onBugReport}
            title="Report a Bug"
          >
            <Bug size={16} />
            <span>Report Bug</span>
          </button>
        </div>
      )}
    </aside>
  );
}

// Small component for the expand button shown when panel is collapsed
export function ContextPanelExpandButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      className="context-panel-expand-btn"
      onClick={onClick}
      title="Expand navigation panel"
      aria-label="Expand navigation panel"
    >
      <ChevronRight size={14} />
    </button>
  );
}
