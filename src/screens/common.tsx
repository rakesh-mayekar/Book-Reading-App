import type { ReactNode } from 'react';
import { useSaveStory } from '../components/SavePrompt';
import { Link, Navigate } from 'react-router-dom';
import { FileQuestion, ShieldAlert } from 'lucide-react';
import { useDB } from '../store/store';
import { accountName, roleOf, type PubStory } from '../domain/rules';
import type { Role } from '../domain/types';
import { Page } from '../components/Shell';
import { EmptyState, LinkButton } from '../components/ui';
import { Cover, Ico, IconButton, Badge, MetaItem } from '../components/ui';
import { actions } from '../store/store';
import { Bookmark, BookmarkCheck, Clock, Globe } from 'lucide-react';
import { readingMinutes } from '../domain/rules';
import { Progress } from '../components/ui';

export function useMe() {
  const db = useDB();
  const id = db.activeAccountId;
  return { db, id, role: roleOf(id) as Role, name: accountName(db, id) };
}

export const homeFor = (role: Role | null) => (role === 'writer' ? '/writer/dashboard' : '/discover');

export function PermissionDenied() {
  const { role } = useMe();
  return (
    <Page title="Not available" fallback={homeFor(role)}>
      <EmptyState icon={ShieldAlert} title="This screen isn’t available to your account" text="It belongs to another demo account or role. Your own screens are unaffected." action={<LinkButton to={homeFor(role)}>Go to my home</LinkButton>} />
    </Page>
  );
}
export function NotFoundState({ what = 'record', to }: { what?: string; to?: string }) {
  const { role } = useMe();
  return (
    <Page title="Not found" fallback={to ?? homeFor(role)}>
      <EmptyState icon={FileQuestion} title={`We can’t find this ${what}`} text="It may have been removed, unpublished or never existed." action={<LinkButton to={to ?? homeFor(role)}>Go back home</LinkButton>} />
    </Page>
  );
}
export function RoleOnly({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useMe();
  return roles.includes(role) ? <>{children}</> : <PermissionDenied />;
}
export function Home() {
  const { db, id, role } = useMe();
  if (role === 'reader' && !db.prefs[id]?.onboarded) return <Navigate to="/welcome" replace />;
  return <Navigate to={homeFor(role)} replace />;
}

export function StoryCard({ story, showProgress }: { story: PubStory; showProgress?: boolean }) {
  const { db, id } = useMe();
  const saved = db.saved.some((s) => s.accountId === id && s.storyId === story.id);
  const save = useSaveStory();
  const prog = db.progress.find((p) => p.accountId === id && p.storyId === story.id);
  const writer = db.writers[story.writerId]?.name ?? 'Unknown writer';
  const frac = prog ? Math.min(1, (prog.chapterIndex + prog.scroll) / Math.max(1, story.chapters.length)) : 0;
  return (
    <article className="story-card">
      <Link to={`/story/${story.id}`} className="main" aria-label={`${story.title} by ${writer}`}>
        <Cover coverId={story.coverId} style={{ width: 84, height: 118 }} />
        <div className="info">
          <h3>{story.title}</h3>
          <p className="t-meta">{writer}</p>
          <div className="row wrap" style={{ gap: '2px 10px' }}>
            <MetaItem>{story.genre}</MetaItem>
            <MetaItem icon={Globe}>{story.language}</MetaItem>
          </div>
          <div className="row wrap" style={{ gap: '2px 10px' }}>
            <MetaItem icon={Clock}>{readingMinutes(story.chapters)} min</MetaItem>
            <MetaItem>{story.status === 'completed' ? 'Completed' : 'Ongoing'}</MetaItem>
          </div>
          <div className="row wrap" style={{ marginTop: 2 }}>{story.adaptationOpen && <Badge tone="open">Open to enquiries</Badge>}</div>
          {showProgress && prog && <Progress value={prog.completed ? 1 : frac} />}
        </div>
      </Link>
      <IconButton className="bm" icon={saved ? BookmarkCheck : Bookmark} label={saved ? `Remove ${story.title} from saved` : `Save ${story.title}`} pressed={saved} onClick={() => save(story)} />
    </article>
  );
}
export { Ico };

/** Vertical story card (Figma 1.5): 165×184 cover with save button, title, writer, meta, status. */
export function StoryTile({ story }: { story: PubStory }) {
  const { db, id, role } = useMe();
  const saved = db.saved.some((s) => s.accountId === id && s.storyId === story.id);
  const save = useSaveStory();
  const writer = db.writers[story.writerId]?.name ?? 'Unknown writer';
  return (
    <article className="tile">
      <div className="tile-cover">
        <Link to={`/story/${story.id}`} aria-label={`${story.title} by ${writer}`}>
          <Cover coverId={story.coverId} style={{ width: 165, height: 184, borderRadius: 12 }} />
        </Link>
        <button className="tile-save" aria-label={saved ? `Remove ${story.title} from saved` : `Save ${story.title}`} aria-pressed={saved} onClick={() => save(story)}>
          <span><Ico i={Bookmark} size={20} />{saved && <i className="tile-fill" />}</span>
        </button>
      </div>
      <Link to={`/story/${story.id}`} className="tile-text" tabIndex={-1}>
        <h3>{story.title}</h3>
        <p className="by">by {writer}</p>
        <p className="meta">{story.genre} · {readingMinutes(story.chapters)} min</p>
        <p className="state">{story.status === 'completed' ? 'Completed' : 'Ongoing'}{role === 'filmmaker' && story.adaptationOpen ? ' · Open to enquiries' : ''}</p>
      </Link>
    </article>
  );
}
