'use client';

import IconRail from './IconRail';
import ContextPanel from './ContextPanel';

interface Props {
  children: React.ReactNode;
  /** Set true for dashboard layout (fixed header + scrollable body) */
  dashboard?: boolean;
}

export default function AppShell({ children, dashboard }: Props) {
  return (
    <div className="zendesk-layout">
      <IconRail />
      <ContextPanel />
      <div className="zendesk-main">
        <main className="zendesk-content">
          {dashboard ? children : <div className="page-content">{children}</div>}
        </main>
      </div>
    </div>
  );
}
