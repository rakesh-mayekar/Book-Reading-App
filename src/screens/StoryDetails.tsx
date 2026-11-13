import { Link, useParams } from 'react-router-dom';
import { useSaveStory } from '../components/SavePrompt';
import { Bookmark, ChevronLeft, Lock, Info } from 'lucide-react';
import { genreIcon, icons } from '../assets/figma';
import { Page, useBack } from '../components/Shell';
import { Button, Cover, Ico, IconButton, LinkButton, Notice } from '../components/ui';
import { enquiryGate, publicStory, readingMinutes } from '../domain/rules';
import { actions, useMode } from '../store/store';
import { NotFoundState, useMe } from './common';

export function StoryDetails() {
  const { id: storyId } = useParams();
  const { db, id, role } = useMe();
  const back = useBack('/discover');
  const mode = useMode();
  const save = useSaveStory();
  const raw = db.stories.find((s) => s.id === storyId);
  const story = raw && publicStory(raw);
  if (!raw || !story) return <NotFoundState what="story" to="/discover" />;
  const writer = db.writers[story.writerId];
  const first = (writer?.name ?? 'the writer').split(' ')[0];
  const saved = db.saved.some((s) => s.accountId === id && s.storyId === story.id);
  const prog = db.progress.find((p) => p.accountId === id && p.storyId === story.id);
  const inProgress = prog && !prog.completed;
  const gate = role === 'filmmaker' ? enquiryGate(db, id, story.id) : null;
  const readTo = `/read/${story.id}/${inProgress ? Math.min(prog.chapterIndex, story.chapters.length - 1) + 1 : 1}`;
  const minutes = (i: number) => readingMinutes([story.chapters[i]]);

  const header = (
    <header className="page-header overlay sd-head">
      <IconButton tone="ghost" icon={ChevronLeft} label="Back" onClick={back} />
      <div style={{ flex: 1 }} />
      <IconButton tone="ghost" icon={Bookmark} pressed={saved} label={saved ? 'Remove from saved' : 'Save story'} onClick={() => save(story)} className={saved ? 'filled' : ''} />
    </header>
  );

  return (
    <Page flush header={header} className="sd" footerClass="sd-foot"
      footer={<><p className="sd-free">Read free{mode === 'demo' ? ' · Demo data on this device' : ''}</p><LinkButton to={readTo}>{prog?.completed ? 'Read again' : inProgress ? `Continue reading · Chapter ${prog.chapterIndex + 1}` : 'Start reading'}<img src={icons.dArrow} alt="" width={18} height={18} /></LinkButton></>}>
      <div className="sd-art">
        <Cover coverId={story.coverId} style={{ width: '100%', height: '100%', borderRadius: 0 }} />
        <div className="sd-art-shade" />
      </div>
      <div className="sd-info">
        <div className="sd-tags">
          <span><span className="gicon sm" style={{ ['--icon' as string]: `url(${genreIcon[story.genre] ?? icons.dSearch})` }} aria-hidden="true" />{story.genre}</span>
          <span><img src={icons.dBook} alt="" width={14} height={14} />{story.language}</span>
          <span><img src={icons.dCheck} alt="" width={14} height={14} />{story.status === 'completed' ? 'Completed' : 'Ongoing'}</span>
        </div>
        <h1 className="sd-title">{story.title}</h1>
        <div className="sd-writer"><span>by {writer?.name ?? 'Unknown'}</span><Link to={`/author/${story.writerId}`}>View writer</Link></div>
        <div className="sd-facts">
          <div><span><img src={icons.dBook} alt="" width={14} height={14} />{String(story.chapters.length).padStart(2, '0')}</span><small>Chapters</small></div>
          <div><span><img src={icons.dClock} alt="" width={14} height={14} />{readingMinutes(story.chapters)} min</span><small>Read time</small></div>
          <div><span><img src={icons.dCheck} alt="" width={14} height={14} />{story.status === 'completed' ? 'Complete' : 'Ongoing'}</span><small>Story status</small></div>
        </div>
        <p className="sd-synopsis">{story.synopsis}</p>

        <section aria-labelledby="inside">
          <Link to={`/story/${story.id}/contents`} className="sd-sec-head"><h2 id="inside">Inside the story</h2><span>All {story.chapters.length} chapters</span></Link>
          <ol className="sd-chapters">
            {story.chapters.slice(0, 3).map((c, i) => (
              <li key={c.id}><Link to={`/read/${story.id}/${i + 1}`}><span className="n">{String(i + 1).padStart(2, '0')}</span><span><b>{c.title}</b><small>{minutes(i)} min read</small></span></Link></li>
            ))}
          </ol>
        </section>

        <section className="sd-adapt" aria-labelledby="adapt-h">
          <h2 id="adapt-h">From the page to the screen</h2>
          <p className="st">{story.adaptationOpen ? 'Open to adaptation' : 'Not open to adaptation right now'}</p>
          <p>{story.adaptationOpen ? `Have a project in mind? Connect with ${first} to discuss this story.` : 'You can still read it for free.'} <span className="muted">Declared by the writer; not proof of rights.</span></p>
          {role === 'filmmaker' && gate ? (
            gate.ok ? (
              <Link className="sd-cta" to={`/story/${story.id}/enquire`}>Discuss adaptation <img src={icons.dArrow} alt="" width={18} height={18} /></Link>
            ) : gate.reason === 'duplicate' ? (
              <Link className="sd-cta" to={`/enquiries/${gate.existingId}`}>View your enquiry <img src={icons.dArrow} alt="" width={18} height={18} /></Link>
            ) : gate.reason === 'blocked' ? (
              <Notice icon={Lock} tone="err">Contact with this writer is unavailable in this prototype.</Notice>
            ) : (
              <Notice icon={Info}>The writer is not taking adaptation enquiries for this story right now. You can still read it for free.</Notice>
            )
          ) : (
            <p className="t-help">{mode === 'account' ? 'Adaptation enquiries are demo-only for now. They open once writer accounts and story ownership are connected.' : 'Only filmmaker accounts can send adaptation enquiries.'}</p>
          )}
        </section>
        {story.writerId === id && <LinkButton variant="secondary" to={`/writer/story/${story.id}/chapters`}>Manage this story</LinkButton>}
        {saved && <Button variant="secondary" onClick={() => actions.toggleSaved(id, story.id)}>Remove from saved</Button>}
      </div>
    </Page>
  );
}
void Ico;
