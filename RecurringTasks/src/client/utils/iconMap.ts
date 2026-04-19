// =============================================================================
// Icon Map - Maps iconEmoji string keys to Lucide React icon components
// =============================================================================

import {
  Home,
  Ticket,
  Users,
  Building2,
  Clock,
  Shield,
  BarChart3,
  Settings,
  FolderOpen,
  Mail,
  Database,
  Cloud,
  Lock,
  Bug,
  Key,
  BookOpen,
  Map,
  Plug,
  Palette,
  Calendar,
  Rocket,
  Repeat,
  RefreshCw,
  MonitorSpeaker,
  type LucideIcon,
} from 'lucide-react';

// Maps the iconEmoji field values from the Application model to Lucide components
export const appIconMap: Record<string, LucideIcon> = {
  rocket: Rocket,
  shield: Shield,
  chart: BarChart3,
  gear: Settings,
  folder: FolderOpen,
  users: Users,
  mail: Mail,
  database: Database,
  cloud: Cloud,
  lock: Lock,
  bug: Bug,
  key: Key,
  book: BookOpen,
  ticket: Ticket,
  map: Map,
  plug: Plug,
  palette: Palette,
  calendar: Calendar,
  clock: Clock,
  bee: MonitorSpeaker,
  repeat: Repeat,
  refresh: RefreshCw,
  building: Building2,
  home: Home,
};

// Quick-link icons for the icon rail (static, always visible)
export const railIcons = {
  home: Home,
  tickets: Ticket,
  contacts: Users,
  companies: Building2,
  timeTracking: Clock,
  backup: Shield,
  recurringTasks: Repeat,
  settings: Settings,
  bug: Bug,
};

// Get a Lucide icon component for an iconEmoji string, with fallback
export function getAppIcon(iconEmoji: string | null | undefined): LucideIcon {
  if (!iconEmoji) return Settings;
  return appIconMap[iconEmoji] || Settings;
}
