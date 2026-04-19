import React, { useState, useEffect, useRef } from 'react';

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

export interface SharedHeaderProps {
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

export default function SharedHeader({
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
}: SharedHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header className={`shared-header ${isMobile ? 'mobile' : ''}`}>
      {/* Left side - Mobile menu button only on mobile */}
      <div className="header-left">
        {showMobileMenuButton && (
          <button
            className="mobile-menu-btn"
            onClick={onMobileMenuClick}
            aria-label="Open menu"
          >
            {'\u2630'}
          </button>
        )}
      </div>

      {/* Center - Search bar (hidden on mobile) */}
      {!isMobile && (
        <div className="header-center">
          <form className="header-search" onSubmit={handleSearch}>
            <span className="search-icon">{'\u{1F50D}'}</span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </form>
        </div>
      )}

      {/* Right side - Notifications, Theme, User */}
      <div className="header-right">
        {/* Notifications */}
        <div className="header-dropdown" ref={notifMenuRef}>
          <button
            className="header-icon-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
          >
            <span className="icon">{'\u{1F514}'}</span>
            {unreadCount > 0 && (
              <span className="badge-count">{unreadCount}</span>
            )}
          </button>
          {showNotifications && (
            <div className="dropdown-menu notifications-menu">
              <div className="dropdown-header">Notifications</div>
              {notifications.length === 0 ? (
                <div className="dropdown-empty">No notifications</div>
              ) : (
                notifications.slice(0, 5).map(notif => (
                  <div
                    key={notif.id}
                    className={`notification-item ${notif.read ? '' : 'unread'}`}
                    onClick={() => onMarkNotificationRead?.(notif.id)}
                  >
                    <div className="notification-title">{notif.title}</div>
                    <div className="notification-message">{notif.message}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          className="header-icon-btn theme-toggle"
          onClick={onThemeToggle}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          <span className="icon">{theme === 'light' ? '\u{1F319}' : '\u2600\uFE0F'}</span>
        </button>

        {/* User Menu */}
        <div className="header-dropdown" ref={userMenuRef}>
          <button
            className="header-user-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <span className="dropdown-arrow">{'\u25BC'}</span>
          </button>
          {showUserMenu && (
            <div className="dropdown-menu user-menu">
              <div className="dropdown-header">
                <div className="user-name">{user?.displayName || user?.email || 'User'}</div>
                <div className="user-email">{user?.email || ''}</div>
                {user?.globalRole && (
                  <div className="user-role">{user.globalRole.replace('_', ' ')}</div>
                )}
              </div>
              <div className="dropdown-divider"></div>
              <a href="/profile" className="dropdown-item">
                <span className="dropdown-icon">{'\u{1F464}'}</span>
                Profile
              </a>
              <a href="/settings" className="dropdown-item">
                <span className="dropdown-icon">{'\u2699\uFE0F'}</span>
                Settings
              </a>
              {(user?.globalRole === 'admin' || user?.globalRole === 'super_admin') && (
                <>
                  <div className="dropdown-divider"></div>
                  <a href="/admin/users" className="dropdown-item">
                    <span className="dropdown-icon">{'\u{1F6E1}'}</span>
                    Admin Panel
                  </a>
                </>
              )}
              <div className="dropdown-divider"></div>
              <button className="dropdown-item logout-item" onClick={onLogout}>
                <span className="dropdown-icon">{'\u{1F6AA}'}</span>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
