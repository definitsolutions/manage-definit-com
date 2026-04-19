import React from 'react';
import {
  Home,
  Repeat,
  StickyNote,
  PhoneCall,
  MailSearch,
  Users,
  Settings,
  Bug,
  type LucideIcon,
} from 'lucide-react';

export interface RailItem {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  external?: boolean;
}

export interface SharedIconRailProps {
  activeId?: string;
  extraItems?: RailItem[];
  onNavigate: (path: string, external?: boolean) => void;
  onBugReport?: () => void;
  onSettings?: () => void;
}

const defaultItems: RailItem[] = [
  { id: 'home', icon: Home, label: 'Dashboard', path: '/' },
  { id: 'recurring-tasks', icon: Repeat, label: 'Recurring Tasks', path: '/', external: true },
  { id: 'notes', icon: StickyNote, label: 'Notes', path: '/notes/', external: true },
  { id: 'callscribe', icon: PhoneCall, label: 'CallScribe', path: '/callscribe/', external: true },
  { id: 'eer', icon: MailSearch, label: 'Email Review', path: '/eer/', external: true },
  { id: 'teams', icon: Users, label: 'Teams Tasks', path: '/teams/', external: true },
];

export default function SharedIconRail({
  activeId,
  extraItems = [],
  onNavigate,
  onBugReport,
  onSettings,
}: SharedIconRailProps) {
  const allItems = [...defaultItems, ...extraItems];

  return (
    <nav className="icon-rail" role="navigation" aria-label="Quick navigation">
      <div className="icon-rail-logo">
        <a href="/" title="Home" className="icon-rail-logo-link">
          <img src="/logo-mark.png" alt="Definit" className="icon-rail-logo-img" />
        </a>
      </div>

      <div className="icon-rail-items">
        {allItems.map(item => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              className={`icon-rail-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.path, item.external)}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
            </button>
          );
        })}
      </div>

      <div className="icon-rail-bottom">
        {onSettings && (
          <button className="icon-rail-item" onClick={onSettings} title="Settings" aria-label="Settings">
            <Settings size={20} strokeWidth={1.75} />
          </button>
        )}
        {onBugReport && (
          <button className="icon-rail-item icon-rail-bug" onClick={onBugReport} title="Report a Bug" aria-label="Report a Bug">
            <Bug size={20} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </nav>
  );
}
