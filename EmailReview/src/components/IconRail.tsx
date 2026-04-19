'use client';

import { useRouter, usePathname } from 'next/navigation';

/**
 * SharedIconRail — matches the 48px icon rail used across all manage.definit.com apps.
 * Uses inline SVGs from Lucide icon set to avoid needing lucide-react as a dependency.
 */

interface RailItem {
  id: string;
  label: string;
  path: string;
  external?: boolean;
  icon: React.ReactNode;
}

const ICON_SIZE = 20;
const STROKE = 1.75;
const STROKE_ACTIVE = 2.5;

// Lucide SVG icons inlined for zero-dependency match with other apps
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? STROKE_ACTIVE : STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function RepeatIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? STROKE_ACTIVE : STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function StickyNoteIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? STROKE_ACTIVE : STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
      <path d="M15 3v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function PhoneCallIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? STROKE_ACTIVE : STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      <path d="M14.05 2a9 9 0 0 1 8 7.94" /><path d="M14.05 6A5 5 0 0 1 18 10" />
    </svg>
  );
}

function MailSearchIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? STROKE_ACTIVE : STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7.5" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <circle cx="18" cy="18" r="3" /><path d="m22 22-1.5-1.5" />
    </svg>
  );
}

function TeamsIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? STROKE_ACTIVE : STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? STROKE_ACTIVE : STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const defaultItems: RailItem[] = [
  { id: 'home', label: 'Dashboard', path: '/', external: true, icon: <HomeIcon active={false} /> },
  { id: 'recurring-tasks', label: 'Recurring Tasks', path: '/', external: true, icon: <RepeatIcon active={false} /> },
  { id: 'notes', label: 'Notes', path: '/notes/', external: true, icon: <StickyNoteIcon active={false} /> },
  { id: 'callscribe', label: 'CallScribe', path: '/callscribe/', external: true, icon: <PhoneCallIcon active={false} /> },
  { id: 'eer', label: 'Email Review', path: '/eer/', external: true, icon: <MailSearchIcon active={false} /> },
  { id: 'teams', label: 'Teams Tasks', path: '/teams/', external: true, icon: <TeamsIcon active={false} /> },
];

export default function IconRail() {
  const router = useRouter();
  const pathname = usePathname();
  const activeId = 'eer'; // This app is always EER

  function handleNavigate(path: string, external?: boolean) {
    if (external) {
      window.location.href = path;
    } else {
      router.push(path);
    }
  }

  return (
    <nav className="icon-rail" role="navigation" aria-label="Quick navigation">
      <div className="icon-rail-logo">
        <a href="/" title="Home" className="icon-rail-logo-link">
          <img src="/eer/logo-mark.png" alt="Definit" className="icon-rail-logo-img" />
        </a>
      </div>

      <div className="icon-rail-items">
        {defaultItems.map((item) => {
          const isActive = item.id === activeId;
          // Re-render icon with correct active stroke
          const IconComponent = (() => {
            switch (item.id) {
              case 'home': return <HomeIcon active={isActive} />;
              case 'recurring-tasks': return <RepeatIcon active={isActive} />;
              case 'notes': return <StickyNoteIcon active={isActive} />;
              case 'callscribe': return <PhoneCallIcon active={isActive} />;
              case 'eer': return <MailSearchIcon active={isActive} />;
              case 'teams': return <TeamsIcon active={isActive} />;
              default: return item.icon;
            }
          })();

          return (
            <button
              key={item.id}
              className={`icon-rail-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNavigate(item.path, item.external)}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {IconComponent}
            </button>
          );
        })}
      </div>

      <div className="icon-rail-bottom">
        <button
          className={`icon-rail-item ${pathname?.startsWith('/eer/config') ? 'active' : ''}`}
          onClick={() => router.push('/config')}
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon active={pathname?.startsWith('/eer/config') ?? false} />
        </button>
      </div>
    </nav>
  );
}
