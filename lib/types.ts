export type RsvpStatus = 'invited' | 'attending' | 'maybe' | 'declined';

export type DerivedEventState = 'upcoming' | 'past';

export type EventScope = 'owned' | 'invited' | 'all';

export type ActivityAction = 'created' | 'updated' | 'invited' | 'rsvp_updated' | 'deleted';

export interface UserProfile {
  uid: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface ApiUserContext {
  uid: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  photoURL?: string;
}

export interface EventInvitationCounts {
  invited: number;
  attending: number;
  maybe: number;
  declined: number;
}

export interface EventRecord {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  organizerUid: string;
  organizerName: string;
  searchBlob: string;
  aiSummary?: string;
  aiAgendaBullets?: string[];
  invitationCounts: EventInvitationCounts;
  createdAt: string;
  updatedAt: string;
}

export interface EventInvitation {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  eventEndsAt: string;
  timezone: string;
  inviteeUid?: string;
  inviteeEmail: string;
  normalizedInviteeEmail: string;
  inviteeName?: string;
  organizerUid: string;
  organizerName: string;
  rsvpStatus: RsvpStatus;
  linkedAt?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventActivityLog {
  id: string;
  eventId: string;
  actorUid: string;
  actorName: string;
  action: ActivityAction;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EventListResponse {
  items: Array<EventRecord & { viewerRsvpStatus?: RsvpStatus; isOrganizer: boolean }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EventDetailResponse {
  event: EventRecord;
  isOrganizer: boolean;
  viewerInvitation: EventInvitation | null;
  invitations: EventInvitation[];
  activity: EventActivityLog[];
}

export interface AnalyticsOverview {
  upcomingCount: number;
  ownedCount: number;
  invitedCount: number;
  conflictCount: number;
  responseDistribution: Array<{ status: Exclude<RsvpStatus, 'invited'> | 'pending'; count: number }>;
  scheduleDensity: Array<{ label: string; count: number }>;
  highRiskEvents: Array<Pick<EventRecord, 'id' | 'title' | 'startsAt' | 'location'> & { riskLabel: string }>;
  recentActivity: EventActivityLog[];
}

export interface DashboardBusinessInsight {
  headline: string;
  summary: string;
  health: 'strong' | 'steady' | 'watch';
  strengths: string[];
  risks: string[];
  recommendations: string[];
  source: 'gemini' | 'fallback';
}

export interface EventRecommendationInsight {
  headline: string;
  reason: string;
  whyNow: string;
  recommendedAction: 'respond' | 'attend' | 'prepare' | 'host' | 'review';
  eventId?: string;
  eventTitle?: string;
  startsAt?: string;
  location?: string;
  source: 'gemini' | 'fallback';
}

export interface SchedulingAssistantInsight {
  summary: string;
  conflictLevel: 'low' | 'medium' | 'high';
  conflictCount: number;
  riskyInvitees: Array<{ email: string; reason: string }>;
  suggestedTimeWindows: Array<{ startsAt: string; endsAt: string; reason: string }>;
  suggestedSummary?: string;
  agendaBullets?: string[];
}
