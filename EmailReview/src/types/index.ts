import type { FlagType, FlagSeverity, ThreadStatus, MessageDirection } from '@prisma/client';

// ── Dashboard view models ────────────────────────────────────

export interface DashboardStats {
  needsReply: number;
  waitingOnTeam: number;
  staleThreads: number;
  promisesMade: number;
  vipHighPriority: number;
  totalFlagged: number;
  delegated: number;
  hasTicket: number;
}

export interface ThreadListItem {
  id: string;
  conversationId: string;
  subject: string;
  lastMessageAt: string;
  lastClientMessageAt: string | null;
  lastSenderEmail: string | null;
  lastSenderIsClient: boolean;
  messageCount: number;
  clientMessageCount: number;
  priorityScore: number;
  status: ThreadStatus;
  companyName: string | null;
  flags: ThreadFlagView[];
  aiSummary: string | null;
  suggestedAction: string | null;
  hasDelegation: boolean;
  hasTicket: boolean;
  delegationInfo: string | null;
}

export interface ThreadFlagView {
  id: string;
  flagType: FlagType;
  severity: FlagSeverity;
  description: string;
}

export interface ThreadDetailView extends ThreadListItem {
  messages: MessageView[];
  aiAnalysis: AIAnalysisView | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface MessageView {
  id: string;
  subject: string;
  senderName: string | null;
  senderEmail: string;
  recipientEmails: string[];
  receivedAt: string;
  isRead: boolean;
  bodyPreview: string;
  direction: MessageDirection;
  isExternal: boolean;
  isClientRelated: boolean;
  categories: string[];
  importance: string;
}

export interface AIAnalysisView {
  id: string;
  summary: string;
  classification: string;
  priority: string;
  suggestedAction: string | null;
  explanation: string | null;
  draftReply: string | null;
  model: string;
  analyzedAt: string;
}

// ── Config types ─────────────────────────────────────────────

export interface AppConfig {
  syncDays: number;
  staleHours: number;
  unreadHours: number;
  urgencyKeywords: string[];
  commitmentPhrases: string[];
  digestTime: string;
  digestTopN: number;
}

export interface ClientDomainInput {
  domain: string;
  companyName?: string;
}

export interface VipContactInput {
  email: string;
  name?: string;
  companyName?: string;
  priority?: number;
}

// ── Digest types ─────────────────────────────────────────────

export interface DigestItem {
  threadId: string;
  subject: string;
  companyName: string | null;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  reasonFlagged: string;
  recommendedAction: string;
  hoursSinceLastClient: number | null;
  flagTypes: FlagType[];
}

export interface DigestContent {
  generatedAt: string;
  items: DigestItem[];
  stats: DashboardStats;
}

// ── Sync types ───────────────────────────────────────────────

export interface SyncResult {
  messagesProcessed: number;
  threadsUpdated: number;
  flagsGenerated: number;
  errors: string[];
}

// ── Filter / query ───────────────────────────────────────────

export type ThreadFilter =
  | 'all'
  | 'needs_reply'
  | 'waiting_on_team'
  | 'stale'
  | 'promises'
  | 'vip'
  | 'flagged';
