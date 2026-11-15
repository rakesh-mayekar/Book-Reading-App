export type Role = 'reader' | 'writer' | 'filmmaker';
export type EnquiryStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';
export type StoryStatus = 'ongoing' | 'completed';
export type ThemeName = 'light' | 'sepia' | 'dark';

export const GENRES = ['Mystery', 'Thriller', 'Romance', 'Drama', 'Fantasy', 'Science Fiction', 'Horror', 'Adventure', 'Historical Fiction', 'Humour'] as const;
export const LANGUAGES = ['English', 'Hindi', 'Marathi'] as const;
export const FORMATS = ['Short film', 'Feature film', 'Web series', 'Audio drama', 'Other'] as const;
export const COVER_IDS = ['train', 'unsent', 'monsoon', 'dusk', 'ink', 'tide', 'ember', 'moss', 'night'] as const;
export const REPORT_REASONS = ['Spam or misleading', 'Harassment or abuse', 'Impersonation', 'Inappropriate content', 'Something else'] as const;

export interface DemoAccount {
  id: string;
  role: Role;
  name: string;
  tagline: string;
}

export interface WriterProfile {
  id: string; // writerId (equals account id for demo writer)
  name: string;
  bio: string;
  photo?: string; // optional data URL
  languages?: string[]; // languages the writer writes in (local to the profile)
  sample?: boolean; // sample profile with no demo login
}

export interface FilmmakerProfile {
  accountId: string;
  name: string;
  role: string;
  team: string;
  portfolio: string;
  intro: string;
  complete: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  body: string;
}

export interface PublishedVersion {
  title: string;
  synopsis: string;
  genre: string;
  language: string;
  coverId: string;
  status: StoryStatus;
  chapters: Chapter[];
  publishedAt: number;
}

export interface Story {
  id: string;
  writerId: string;
  title: string;
  synopsis: string;
  genre: string;
  language: string;
  coverId: string;
  status: StoryStatus;
  /** Live setting, writer-declared. Not part of the published snapshot. */
  adaptationOpen: boolean;
  chapters: Chapter[];
  published: PublishedVersion | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReadingProgress {
  accountId: string;
  storyId: string;
  chapterIndex: number;
  scroll: number; // 0..1
  completed: boolean;
  updatedAt: number;
}

export interface SavedStory {
  accountId: string;
  storyId: string;
  savedAt: number;
}

/** Writer / Filmmaker are independent, owner-approved professional roles. Every account is a Reader. */
export type RoleKind = 'writer' | 'filmmaker';
export type RoleState = 'not_requested' | 'draft' | 'pending' | 'approved' | 'changes_requested' | 'rejected';
export interface RoleApp { state: RoleState; feedback?: string; submittedAt?: number; decidedAt?: number }

export interface UserPreferences {
  onboarded: boolean;
  /** The "How will you use Stories?" step has been shown for this account. */
  roleSetup?: boolean;
  genres: string[];
  languages: string[];
  fontSize: number; // 0..3
  theme: ThemeName;
}

export interface EnquiryDraft {
  accountId: string;
  storyId: string;
  projectTitle: string;
  format: string; // '' until chosen
  proposal: string;
}

export interface AdaptationEnquiry {
  id: string;
  storyId: string;
  writerId: string;
  filmmakerId: string;
  intro: { name: string; role: string; team: string; portfolio: string; intro: string };
  projectTitle: string;
  format: string;
  proposal: string;
  status: EnquiryStatus;
  declineReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  enquiryId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export interface Report {
  id: string;
  reporterId: string;
  targetId: string;
  enquiryId: string;
  reason: string;
  details: string;
  createdAt: number;
}

export interface BlockRelationship {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: number;
}

export interface Filters {
  genres: string[];
  languages: string[];
  status: '' | StoryStatus;
  query: string;
  openOnly?: boolean;
}

export interface DB {
  version: number;
  /** Present only for a real (Supabase) account session. Never persisted locally. */
  realUser?: { id: string; name: string; email: string };
  activeAccountId: string;
  writers: Record<string, WriterProfile>;
  filmmakers: Record<string, FilmmakerProfile>;
  stories: Story[];
  progress: ReadingProgress[];
  saved: SavedStory[];
  prefs: Record<string, UserPreferences>;
  drafts: EnquiryDraft[];
  enquiries: AdaptationEnquiry[];
  messages: Message[];
  reports: Report[];
  blocks: BlockRelationship[];
  composer: Record<string, string>;
  filters: Record<string, Filters>;
  enquiryFilter: Record<string, '' | EnquiryStatus>;
  /** Role applications per account. Missing = derived from the seeded demo roles (Mira = Writer, Kabir = Filmmaker). */
  roleApps?: Record<string, Partial<Record<RoleKind, RoleApp>>>;
}
