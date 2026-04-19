// =============================================================================
// Tab Manager - localStorage-persisted tab state for Zendesk-style tab bar
// =============================================================================

export interface Tab {
  id: string;
  url: string;
  title: string;
  icon?: string;
  appSlug?: string;
  active: boolean;
}

const STORAGE_KEY = 'definit_tabs';
const MAX_TABS = 10;
const EVENT_NAME = 'tabsChanged';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export function getTabs(): Tab[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Tab[];
  } catch {
    return [];
  }
}

function saveTabs(tabs: Tab[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function addTab(url: string, title: string, appSlug?: string, icon?: string): Tab {
  const tabs = getTabs();

  // If tab with same URL exists, activate it instead
  const existing = tabs.find(t => t.url === url);
  if (existing) {
    return activateTab(existing.id);
  }

  // Deactivate all others
  tabs.forEach(t => t.active = false);

  const newTab: Tab = {
    id: generateId(),
    url,
    title,
    icon,
    appSlug,
    active: true,
  };

  tabs.push(newTab);

  // Enforce max tabs - remove oldest inactive
  while (tabs.length > MAX_TABS) {
    const oldestInactive = tabs.findIndex(t => !t.active);
    if (oldestInactive >= 0) {
      tabs.splice(oldestInactive, 1);
    } else {
      tabs.shift();
    }
  }

  saveTabs(tabs);
  return newTab;
}

export function removeTab(id: string): Tab[] {
  let tabs = getTabs();
  const removedIndex = tabs.findIndex(t => t.id === id);
  const wasActive = tabs[removedIndex]?.active;
  tabs = tabs.filter(t => t.id !== id);

  // If removed tab was active, activate the nearest tab
  if (wasActive && tabs.length > 0) {
    const newActiveIndex = Math.min(removedIndex, tabs.length - 1);
    tabs[newActiveIndex].active = true;
  }

  saveTabs(tabs);
  return tabs;
}

export function activateTab(id: string): Tab {
  const tabs = getTabs();
  let activated: Tab | null = null;

  tabs.forEach(t => {
    t.active = t.id === id;
    if (t.active) activated = t;
  });

  saveTabs(tabs);
  return activated!;
}

export function updateTabTitle(id: string, title: string): void {
  const tabs = getTabs();
  const tab = tabs.find(t => t.id === id);
  if (tab) {
    tab.title = title;
    saveTabs(tabs);
  }
}

export function updateActiveTabTitle(title: string): void {
  const tabs = getTabs();
  const active = tabs.find(t => t.active);
  if (active) {
    active.title = title;
    saveTabs(tabs);
  }
}

export function getActiveTab(): Tab | null {
  return getTabs().find(t => t.active) || null;
}

export function clearAllTabs(): void {
  saveTabs([]);
}

export function onTabsChanged(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
