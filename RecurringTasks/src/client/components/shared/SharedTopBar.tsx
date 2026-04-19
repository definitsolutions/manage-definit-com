// =============================================================================
// SharedTopBar - 48px top bar with app selector, tabs, and action buttons
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Search,
  Bell,
  Moon,
  Sun,
  X,
  Plus,
  Menu,
  LogOut,
  User,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { getAppIcon } from '../../utils/iconMap';
import { getTabs, addTab, removeTab, activateTab, onTabsChanged, type Tab } from '../../utils/tabManager';

export interface AppInfo {
  slug: string;
  name: string;
  iconEmoji: string | null;
  iconUrl?: string | null;
  basePath?: string;
}

export interface UserInfo {
  email: string;
  displayName?: string;
  globalRole?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

export interface SharedTopBarProps {
  /** Current app info for the app selector */
  currentAppName: string;
  currentAppSlug: string;
  /** All available apps for the app switcher dropdown */
  apps: AppInfo[];
  /** Current user info */
  user: UserInfo | null;
  /** Notifications list */
  notifications?: Notification[];
  /** Current theme */
  theme: 'light' | 'dark';
  /** Callback when theme is toggled */
  onThemeToggle: () => void;
  /** Callback when user logs out */
  onLogout: () => void;
  /** Callback when notification is marked as read */
  onMarkNotificationRead?: (id: string) => void;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Callback when search is submitted */
  onSearch?: (query: string) => void;
  /** Whether to show mobile menu button */
  showMobileMenuButton?: boolean;
  /** Callback when mobile menu button is clicked */
  onMobileMenuClick?: () => void;
  /** Whether this is mobile view */
  isMobile?: boolean;
}

export default function SharedTopBar({
  currentAppName,
  currentAppSlug,
  apps,
  user,
  notifications = [],
  theme,
  onThemeToggle,
  onLogout,
  onMarkNotificationRead,
  searchPlaceholder = 'Search...',
  onSearch,
  showMobileMenuButton = false,
  onMobileMenuClick,
  isMobile = false,
}: SharedTopBarProps) {
  const [showAppSwitcher, setShowAppSwitcher] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabs, setTabs] = useState<Tab[]>(getTabs);

  const appSwitcherRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Listen for tab changes
  useEffect(() => {
    const unsub = onTabsChanged(() => setTabs(getTabs()));
    return unsub;
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (appSwitcherRef.current && !appSwitcherRef.current.contains(e.target as Node)) {
        setShowAppSwitcher(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const otherApps = apps.filter(a => a.slug !== currentAppSlug);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const handleTabClick = (tab: Tab) => {
    const activated = activateTab(tab.id);
    setTabs(getTabs());
    // Navigate to tab URL
    if (tab.url !== window.location.pathname) {
      window.location.href = tab.url;
    }
  };

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const remaining = removeTab(tabId);
    setTabs(remaining);
    // If the closed tab was active and there are remaining tabs, navigate to the new active
    const newActive = remaining.find(t => t.active);
    if (newActive && newActive.url !== window.location.pathname) {
      window.location.href = newActive.url;
    }
  };

  const handleAddTab = () => {
    addTab(window.location.pathname, document.title || currentAppName, currentAppSlug);
    setTabs(getTabs());
  };

  const renderAppIcon = (app: AppInfo) => {
    if (app.iconUrl) {
      return <img src={app.iconUrl} alt="" className="top-bar-app-icon-img" />;
    }
    const IconComp = getAppIcon(app.iconEmoji);
    return <IconComp size={16} />;
  };

  return (
    <header className="top-bar" role="banner">
      {/* Left: Mobile menu + App Switcher */}
      <div className="top-bar-left">
        {showMobileMenuButton && (
          <button
            className="top-bar-icon-btn top-bar-mobile-menu"
            onClick={onMobileMenuClick}
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>
        )}

        {/* App Switcher Dropdown */}
        <div className="top-bar-app-switcher" ref={appSwitcherRef}>
          <button
            className="top-bar-app-switcher-btn"
            style={{ cursor: "default" }}
          >
            <span className="top-bar-app-name">{currentAppName}</span>
            
          </button>
          {false && (
            <div className="top-bar-app-dropdown">
              {otherApps.map(app => (
                <a
                  key={app.slug}
                  href={app.basePath || `/apps/${app.slug}`}
                  className="top-bar-app-dropdown-item"
                  onClick={() => setShowAppSwitcher(false)}
                >
                  <span className="top-bar-app-dropdown-icon">{renderAppIcon(app)}</span>
                  <span>{app.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Tab bar */}
      {!isMobile && (
        <div className="top-bar-center">
          <div className="top-bar-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`top-bar-tab ${tab.active ? 'active' : ''}`}
                onClick={() => handleTabClick(tab)}
                title={tab.title}
              >
                <span className="top-bar-tab-title">{tab.title}</span>
                <span
                  className="top-bar-tab-close"
                  onClick={(e) => handleTabClose(e, tab.id)}
                  role="button"
                  aria-label={`Close ${tab.title}`}
                >
                  <X size={12} />
                </span>
              </button>
            ))}
            <button
              className="top-bar-tab-add"
              onClick={handleAddTab}
              title="Pin current page as tab"
              aria-label="Add tab"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Right: Action buttons */}
      <div className="top-bar-right">
        {/* Search */}
        <div className="top-bar-dropdown" ref={searchRef}>
          <button
            className="top-bar-icon-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="Search"
            aria-label="Search"
          >
            <Search size={18} />
          </button>
          {showSearch && (
            <div className="top-bar-search-dropdown">
              <form onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                  className="top-bar-search-input"
                />
              </form>
            </div>
          )}
        </div>


        {/* Notifications */}
        <div className="top-bar-dropdown" ref={notifRef}>
          <button
            className="top-bar-icon-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="top-bar-badge">{unreadCount}</span>
            )}
          </button>
          {showNotifications && (
            <div className="top-bar-notif-dropdown">
              <div className="top-bar-dropdown-header">Notifications</div>
              {notifications.length === 0 ? (
                <div className="top-bar-dropdown-empty">No notifications</div>
              ) : (
                notifications.slice(0, 5).map(notif => (
                  <div
                    key={notif.id}
                    className={`top-bar-notif-item ${notif.read ? '' : 'unread'}`}
                    onClick={() => onMarkNotificationRead?.(notif.id)}
                  >
                    <div className="top-bar-notif-title">{notif.title}</div>
                    <div className="top-bar-notif-message">{notif.message}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          className="top-bar-icon-btn"
          onClick={onThemeToggle}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* User Menu */}
        <div className="top-bar-dropdown" ref={userMenuRef}>
          <button
            className="top-bar-user-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User menu"
          >
            <div className="top-bar-avatar">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
          </button>
          {showUserMenu && (
            <div className="top-bar-user-dropdown">
              <div className="top-bar-dropdown-header">
                <div className="top-bar-user-name">{user?.displayName || user?.email || 'User'}</div>
                <div className="top-bar-user-email">{user?.email || ''}</div>
                {user?.globalRole && (
                  <div className="top-bar-user-role">{user.globalRole.replace('_', ' ')}</div>
                )}
              </div>
              <div className="top-bar-dropdown-divider" />
              <a href="/profile" className="top-bar-dropdown-item" onClick={() => setShowUserMenu(false)}>
                <User size={16} />
                <span>Profile</span>
              </a>
              <a href="/settings" className="top-bar-dropdown-item" onClick={() => setShowUserMenu(false)}>
                <Settings size={16} />
                <span>Settings</span>
              </a>
              {(user?.globalRole === 'admin' || user?.globalRole === 'super_admin') && (
                <>
                  <div className="top-bar-dropdown-divider" />
                  <a href="/admin/users" className="top-bar-dropdown-item" onClick={() => setShowUserMenu(false)}>
                    <ShieldCheck size={16} />
                    <span>Admin Panel</span>
                  </a>
                </>
              )}
              <div className="top-bar-dropdown-divider" />
              <button className="top-bar-dropdown-item top-bar-logout" onClick={onLogout}>
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
