import { useParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Page } from '../components/Shell';
import { EmptyState, LinkButton } from '../components/ui';
import { enquiryGate, publishedStories } from '../domain/rules';
import { StoryStrip } from './Filmmaker';
import { NotFoundState, useMe } from './common';

export function Author() {
  const { id: wid = '' } = useParams();
  const { db, id, role } = useMe();
  const w = db.writers[wid];
  if (!w) return <NotFoundState what="writer" to="/discover" />;
  const stories = publishedStories(db).filter((s) => s.writerId === wid);
  const open = stories.filter((s) => s.adaptationOpen);
  const initials = w.name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const tags = [...new Set(stories.map((s) => s.genre))].slice(0, 2).concat(w.languages?.length ? w.languages.slice(0, 1) : [...new Set(stories.map((s) => s.language))].slice(0, 1));
  return (
    <Page title="Writer profile" centerTitle fallback="/discover">
      <div className="stack">
        {w.photo ? <img className="fm-avatar" src={w.photo} alt="" /> : <div className="fm-avatar" aria-hidden="true">{initials}</div>}
        <h1 className="fm-h1" style={{ margin: 0 }}>{w.name}</h1>
        {tags.length > 0 && <p className="fm-sub">{tags.join(' · ')}</p>}
        <p className="fm-val" style={{ color: 'var(--muted)' }}>{w.bio}</p>
        <p className="fm-help">Profile details are provided by the writer{w.sample ? ' (sample profile)' : ''}. Personal email and phone numbers are never shown.</p>
        {wid === id && <LinkButton variant="secondary" to="/profile/writer">Edit my profile</LinkButton>}
        <h2 className="fm-h2" id="st-h">Published stories</h2>
        {stories.length ? stories.map((s) => <StoryStrip key={s.id} story={s} writer={w.name} to={`/story/${s.id}`} />) : <EmptyState icon={BookOpen} title="No published stories" text="This writer hasn’t published anything yet." />}
        {role === 'filmmaker' && open.map((s) => {
          const g = enquiryGate(db, id, s.id);
          return (
            <div className="fm-box" key={s.id}>
              <h3>Open to adaptation discussions</h3>
              {g.ok ? <><p>Send a proposal for {s.title}. Personal contact details are not shared automatically.</p><LinkButton arrow to={`/story/${s.id}/enquire`}>Discuss this story</LinkButton></>
                : g.reason === 'duplicate' ? <><p>You already have an enquiry for {s.title}.</p><LinkButton variant="secondary" arrow to={`/enquiries/${g.existingId}`}>View your enquiry</LinkButton></>
                : <p>Contact is unavailable for {s.title}.</p>}
            </div>
          );
        })}
      </div>
    </Page>
  );
}
