import { useSearchParams } from 'react-router-dom';
import { BookMarked, BookOpen, CheckCircle2 } from 'lucide-react';
import { Page } from '../components/Shell';
import { EmptyState, LinkButton } from '../components/ui';
import { publicStory, type PubStory } from '../domain/rules';
import { StoryCard, useMe } from './common';

const TABS = [['saved', 'Saved'], ['progress', 'In progress'], ['completed', 'Completed']] as const;

export function Library() {
  const { db, id, role } = useMe();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'saved' | 'progress' | 'completed') || 'saved';
  const pub = (sid: string) => {
    const s = db.stories.find((x) => x.id === sid);
    return s && publicStory(s);
  };
  const pick = (ids: string[]) => ids.map(pub).filter((s): s is PubStory => !!s);
  const saved = pick(db.saved.filter((s) => s.accountId === id).sort((a, b) => b.savedAt - a.savedAt).map((s) => s.storyId));
  const mine = db.progress.filter((p) => p.accountId === id).sort((a, b) => b.updatedAt - a.updatedAt);
  const progress = pick(mine.filter((p) => !p.completed).map((p) => p.storyId));
  const completed = pick(mine.filter((p) => p.completed).map((p) => p.storyId));
  const list = tab === 'saved' ? saved : tab === 'progress' ? progress : completed;
  const empty = {
    saved: { icon: BookMarked, title: 'Nothing saved yet', text: 'Tap the bookmark on any story to keep it here.' },
    progress: { icon: BookOpen, title: 'No stories in progress', text: 'Start reading and your place is saved automatically.' },
    completed: { icon: CheckCircle2, title: 'No finished stories yet', text: 'Stories you finish will appear here.' },
  }[tab];
  return (
    <Page nav noBack title={role === 'filmmaker' ? 'Saved & reading' : 'Your library'}>
      <div role="tablist" aria-label="Library sections" className="segment" style={{ marginBottom: 16 }}>
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k }, { replace: true })}>{l} ({k === 'saved' ? saved.length : k === 'progress' ? progress.length : completed.length})</button>
        ))}
      </div>
      {list.length ? (
        <div className="stack-sm" role="tabpanel">{list.map((s) => <StoryCard key={s.id} story={s} showProgress={tab !== 'saved'} />)}</div>
      ) : (
        <EmptyState {...empty} action={<LinkButton to="/discover">Discover stories</LinkButton>} />
      )}
    </Page>
  );
}
