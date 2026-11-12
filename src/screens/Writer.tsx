import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, ChevronRight, FilePlus2, Film, Inbox, Pencil, Plus, Trash2, CheckCircle2, AlertCircle, Eye, Camera } from 'lucide-react';
import { ConfirmModal } from '../components/Dialog';
import { Page, toast } from '../components/Shell';
import { Avatar, Badge, Button, Chip, Cover, EmptyState, Ico, IconButton, LinkButton, Notice, Switch, TextArea, TextField } from '../components/ui';
import { chapterState, hasUnpublishedChanges, publishProblems, readingMinutes, validateStoryMeta } from '../domain/rules';
import { COVER_IDS, GENRES, LANGUAGES, type Story } from '../domain/types';
import { actions } from '../store/store';
import { NotFoundState, PermissionDenied, useMe } from './common';

function useOwnStory() {
  const { id: storyId = '' } = useParams();
  const me = useMe();
  const story = me.db.stories.find((s) => s.id === storyId);
  return { ...me, story, storyId };
}
const storyBadge = (s: Story) => (!s.published ? <Badge>Draft</Badge> : hasUnpublishedChanges(s) ? <Badge tone="pending">Unpublished changes</Badge> : <Badge tone="ok">Published</Badge>);

/* ---- Dashboard ---- */
export function WriterDashboard() {
  const { db, id, name } = useMe();
  const mine = db.stories.filter((s) => s.writerId === id);
  const drafts = mine.filter((s) => !s.published);
  const pub = mine.filter((s) => s.published);
  const pending = db.enquiries.filter((e) => e.writerId === id && e.status === 'pending').length;
  const Row = (s: Story) => (
    <Link key={s.id} to={`/writer/story/${s.id}/chapters`} className="list-row">
      <Cover coverId={s.coverId} style={{ width: 44, height: 60 }} />
      <span className="grow"><span className="t-h3" style={{ display: 'block' }}>{s.title || 'Untitled story'}</span><span className="t-meta">{s.chapters.length} chapters</span><div style={{ marginTop: 4 }}>{storyBadge(s)}</div></span>
      <Ico i={ChevronRight} size={20} />
    </Link>
  );
  return (
    <Page nav noBack title={`Hello, ${name.split(' ')[0]}`} right={<LinkButton block={false} to="/writer/story/new" icon={Plus}>New story</LinkButton>}>
      <div className="stack">
        <Link to="/enquiries" className="card dark row between" style={{ textDecoration: 'none', minHeight: 72 }}>
          <span className="row" style={{ gap: 12 }}><Ico i={Inbox} size={26} /><span><span className="t-h3" style={{ display: 'block' }}>Adaptation enquiries</span><span className="t-meta" style={{ color: 'rgba(255,255,255,.75)' }}>{pending ? `${pending} pending ${pending === 1 ? 'request' : 'requests'}` : 'No pending requests'}</span></span></span>
          <Ico i={ChevronRight} size={20} />
        </Link>
        <section aria-labelledby="dr-h" className="stack-sm">
          <h2 className="t-h2" id="dr-h">Drafts</h2>
          {drafts.length ? drafts.map(Row) : <EmptyState icon={FilePlus2} title="No drafts" text="Start a story and it will be saved here until you publish." action={<LinkButton to="/writer/story/new">Create story</LinkButton>} />}
        </section>
        <section aria-labelledby="pb-h" className="stack-sm">
          <h2 className="t-h2" id="pb-h">Published</h2>
          {pub.length ? pub.map(Row) : <p className="t-meta">Nothing published yet. Publish a draft to make it public.</p>}
        </section>
      </div>
    </Page>
  );
}

/* ---- Writer profile ---- */
export function WriterProfileEdit() {
  const { db, id } = useMe();
  const w = db.writers[id];
  const [name, setName] = useState(w?.name ?? '');
  const [bio, setBio] = useState(w?.bio ?? '');
  const [photo, setPhoto] = useState(w?.photo);
  const [tried, setTried] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const errors = { name: name.trim().length < 2 ? 'Enter your display name.' : '', bio: bio.trim().length < 20 ? 'Write at least 20 characters about yourself.' : bio.length > 400 ? 'Keep your bio under 400 characters.' : '' };
  const onFile = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setPhotoErr('Choose an image file.');
    if (f.size > 150_000) return setPhotoErr('Choose an image under 150 KB.');
    const r = new FileReader();
    r.onload = () => { setPhoto(String(r.result)); setPhotoErr(''); };
    r.readAsDataURL(f);
  };
  return (
    <Page title="Writer profile" fallback="/profile" footer={<Button onClick={() => { setTried(true); if (errors.name || errors.bio) return; actions.saveWriterProfile({ id, name: name.trim(), bio: bio.trim(), photo }); toast('Profile saved'); }}>Save profile</Button>}>
      <div className="stack">
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={name || 'W'} photo={photo} size={72} />
          <div className="stack-sm">
            <label className="btn btn-secondary" style={{ height: 44, cursor: 'pointer' }}><Ico i={Camera} size={18} /> Choose photo<input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} /></label>
            {photo && <button className="btn-link" onClick={() => setPhoto(undefined)}>Remove photo</button>}
          </div>
        </div>
        {photoErr ? <p className="t-error" role="alert">{photoErr}</p> : <p className="t-help">Optional. Stored only on this device.</p>}
        <TextField label="Display name" value={name} onChange={setName} error={tried ? errors.name : ''} autoComplete="off" />
        <TextArea label="Bio" value={bio} onChange={setBio} error={tried ? errors.bio : ''} help={`${bio.length}/400 · shown on your public profile`} />
      </div>
    </Page>
  );
}

/* ---- Story setup ---- */
export function StorySetup({ isNew }: { isNew?: boolean }) {
  const { db, id, story } = useOwnStory();
  const navigate = useNavigate();
  const [f, setF] = useState(() => ({
    title: story?.title ?? '', synopsis: story?.synopsis ?? '', genre: story?.genre ?? '', language: story?.language ?? '', coverId: story?.coverId ?? '',
    status: story?.status ?? ('ongoing' as Story['status']), adaptationOpen: story?.adaptationOpen ?? false,
  }));
  const [tried, setTried] = useState(false);
  if (!isNew && !story) return <NotFoundState what="story" to="/writer/dashboard" />;
  if (story && story.writerId !== id) return <PermissionDenied />;
  const errors = validateStoryMeta(f);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    const clean = { ...f, title: f.title.trim(), synopsis: f.synopsis.trim() };
    if (isNew) {
      const sid = actions.createStory(id, clean);
      toast('Draft saved');
      navigate(`/writer/story/${sid}/chapters`, { replace: true });
    } else {
      actions.updateStory(story!.id, clean);
      toast('Draft saved');
      navigate(`/writer/story/${story!.id}/chapters`, { replace: true });
    }
  };
  void db;
  return (
    <Page title={isNew ? 'New story' : 'Story setup'} fallback="/writer/dashboard" footer={<Button onClick={save}>{isNew ? 'Save draft & add chapters' : 'Save draft'}</Button>}>
      <div className="stack">
        <TextField label="Title" value={f.title} onChange={(v) => set('title', v)} error={tried ? errors.title : ''} maxLength={80} />
        <TextArea label="Synopsis" value={f.synopsis} onChange={(v) => set('synopsis', v)} error={tried ? errors.synopsis : ''} help="Two or three sentences readers see first." />
        <fieldset className="field"><legend className="label">Genre</legend>
          <div className="chips" role="radiogroup" aria-label="Genre">{GENRES.map((g) => <Chip radio key={g} selected={f.genre === g} onClick={() => set('genre', g)}>{g}</Chip>)}</div>
          {tried && errors.genre && <p className="t-error" role="alert">{errors.genre}</p>}</fieldset>
        <fieldset className="field"><legend className="label">Language</legend>
          <div className="chips" role="radiogroup" aria-label="Language">{LANGUAGES.map((g) => <Chip radio key={g} selected={f.language === g} onClick={() => set('language', g)}>{g}</Chip>)}</div>
          {tried && errors.language && <p className="t-error" role="alert">{errors.language}</p>}</fieldset>
        <fieldset className="field"><legend className="label">Cover</legend>
          <div className="cover-picker" role="radiogroup" aria-label="Cover">
            {COVER_IDS.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={f.coverId === c} aria-label={`Cover ${c}`} className="cover-option" onClick={() => set('coverId', c)}>
                <Cover coverId={c} style={{ width: '100%', aspectRatio: '3/4' }} />
                {f.coverId === c && <span className="tick"><Ico i={Check} size={14} /></span>}
              </button>
            ))}
          </div>
          {tried && errors.coverId && <p className="t-error" role="alert">{errors.coverId}</p>}</fieldset>
        <fieldset className="field"><legend className="label">Story status</legend>
          <div className="chips" role="radiogroup" aria-label="Story status">{(['ongoing', 'completed'] as const).map((s) => <Chip radio key={s} selected={f.status === s} onClick={() => set('status', s)}>{s === 'ongoing' ? 'Ongoing' : 'Completed'}</Chip>)}</div></fieldset>
        <div className="switch-row">
          <div><span className="t-h3" style={{ display: 'block' }}>Open to adaptation enquiries</span><span className="t-help">Declared by you. It is not proof of rights, and it only affects new enquiries once saved.</span></div>
          <Switch label="Open to adaptation enquiries" checked={f.adaptationOpen} onChange={(v) => set('adaptationOpen', v)} />
        </div>
      </div>
    </Page>
  );
}

/* ---- Chapter list ---- */
export function Chapters() {
  const { id, story, storyId } = useOwnStory();
  const navigate = useNavigate();
  const [del, setDel] = useState<string | null>(null);
  if (!story) return <NotFoundState what="story" to="/writer/dashboard" />;
  if (story.writerId !== id) return <PermissionDenied />;
  const CS = { published: <Badge tone="ok">Published</Badge>, changed: <Badge tone="pending">Draft changes</Badge>, new: <Badge>Draft</Badge> };
  return (
    <Page title={story.title || 'Untitled story'} fallback="/writer/dashboard"
      footer={<><Button icon={Eye} disabled={story.chapters.length === 0} onClick={() => navigate(`/writer/story/${storyId}/preview`)}>Preview & publish</Button>{story.chapters.length === 0 && <p className="t-help" style={{ textAlign: 'center' }}>Add a chapter to preview and publish.</p>}</>}>
      <div className="stack">
        <div className="row between">{storyBadge(story)}<LinkButton variant="secondary" to={`/writer/story/${storyId}/setup`} icon={Pencil}>Edit details</LinkButton></div>
        {story.published && hasUnpublishedChanges(story) && <Notice icon={AlertCircle} tone="warn">Readers still see the last published version. Publish to make these changes public.</Notice>}
        <div className="switch-row">
          <div><span className="t-h3" style={{ display: 'block' }}>Open to adaptation enquiries</span><span className="t-help">Applies immediately to new enquiries. Existing enquiries are not affected.</span></div>
          <Switch label="Open to adaptation enquiries" checked={story.adaptationOpen} onChange={(v) => { actions.updateStory(storyId, { adaptationOpen: v }); toast(v ? 'Now open to enquiries' : 'No longer open to new enquiries'); }} />
        </div>
        <div className="section-head" style={{ margin: 0 }}><h2 className="t-h2">Chapters ({story.chapters.length})</h2></div>
        {story.chapters.length === 0 && <EmptyState icon={FilePlus2} title="No chapters yet" text="Add your first chapter to start writing." />}
        <ol className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {story.chapters.map((c, i) => (
            <li key={c.id} className="card stack-sm">
              <Link to={`/writer/story/${storyId}/chapter/${c.id}`} className="row" style={{ gap: 10, textDecoration: 'none', minHeight: 44 }}>
                <span className="num list-row" style={{ width: 32, height: 32, minHeight: 0, padding: 0, justifyContent: 'center', borderRadius: '50%' }}>{i + 1}</span>
                <span className="grow t-h3" style={{ flex: 1, minWidth: 0 }}>{c.title || 'Untitled chapter'}</span>
                {CS[chapterState(story, c.id)]}
              </Link>
              <div className="row">
                <IconButton icon={ArrowUp} label={`Move chapter ${i + 1} up`} disabled={i === 0} onClick={() => actions.moveChapter(storyId, c.id, -1)} />
                <IconButton icon={ArrowDown} label={`Move chapter ${i + 1} down`} disabled={i === story.chapters.length - 1} onClick={() => actions.moveChapter(storyId, c.id, 1)} />
                <div style={{ flex: 1 }} />
                <IconButton icon={Trash2} label={`Delete chapter ${i + 1}`} onClick={() => setDel(c.id)} />
              </div>
            </li>
          ))}
        </ol>
        <Button variant="secondary" icon={Plus} onClick={() => navigate(`/writer/story/${storyId}/chapter/${actions.addChapter(storyId)}`)}>Add chapter</Button>
      </div>
      <ConfirmModal open={!!del} destructive title="Delete this chapter?" confirmLabel="Delete chapter" onCancel={() => setDel(null)} onConfirm={() => { if (del) actions.deleteChapter(storyId, del); setDel(null); toast('Chapter deleted'); }}
        body="The chapter is removed from your draft. If it was already published, readers keep seeing it until you publish again." />
    </Page>
  );
}

/* ---- Chapter editor with debounced autosave ---- */
export function ChapterEditor() {
  const { cid = '' } = useParams();
  const { id, story, storyId } = useOwnStory();
  const chapter = story?.chapters.find((c) => c.id === cid);
  const [title, setTitle] = useState(chapter?.title ?? '');
  const [body, setBody] = useState(chapter?.body ?? '');
  const [state, setState] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const latest = useRef({ title, body });
  const dirty = useRef(false);
  const timer = useRef<number>();
  const navigate = useNavigate();
  const flush = () => {
    window.clearTimeout(timer.current);
    if (!dirty.current || !chapter) return;
    actions.saveChapter(storyId, { id: cid, ...latest.current });
    dirty.current = false;
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  const edit = (t: string, b: string) => {
    latest.current = { title: t, body: b };
    dirty.current = true;
    setState('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setState('saving'); flushRef.current(); setTimeout(() => setState('saved'), 250); }, 700);
  };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { flushRef.current(); e.preventDefault(); } };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); flushRef.current(); };
  }, []);
  const wc = useMemo(() => (body.trim() ? body.trim().split(/\s+/).length : 0), [body]);
  if (!story || !chapter) return <NotFoundState what="chapter" to="/writer/dashboard" />;
  if (story.writerId !== id) return <PermissionDenied />;
  const label = state === 'saved' ? 'All changes saved on this device' : state === 'saving' ? 'Saving…' : 'Unsaved changes…';
  return (
    <Page title="Edit chapter" fallback={`/writer/story/${storyId}/chapters`} onBack={() => { flush(); navigate(`/writer/story/${storyId}/chapters`, { replace: true }); }}
      right={<span className="t-meta" role="status" aria-live="polite" data-testid="save-state" style={{ textAlign: 'right', maxWidth: 120, fontSize: 12 }}>{state === 'saved' && <Ico i={CheckCircle2} size={14} />} {label}</span>}
      footer={<Button onClick={() => { flush(); setState('saved'); toast('Chapter saved'); navigate(`/writer/story/${storyId}/chapters`, { replace: true }); }}>Save and close</Button>}>
      <div className="stack">
        <TextField label="Chapter title" value={title} onChange={(v) => { setTitle(v); edit(v, body); }} maxLength={90} />
        <TextArea label="Chapter text" value={body} onChange={(v) => { setBody(v); edit(title, v); }} style={{ minHeight: 360 }} help={`${wc} words · separate paragraphs with a blank line`} />
      </div>
    </Page>
  );
}

/* ---- Preview ---- */
export function Preview() {
  const { id, story, storyId } = useOwnStory();
  if (!story) return <NotFoundState what="story" to="/writer/dashboard" />;
  if (story.writerId !== id) return <PermissionDenied />;
  return (
    <Page title="Reader preview" fallback={`/writer/story/${storyId}/chapters`} footer={<LinkButton to={`/writer/story/${storyId}/publish`}>Continue to publish review</LinkButton>}>
      <div className="stack">
        <Notice icon={Eye}>This is how your current draft will look to readers.</Notice>
        <div className="row" style={{ gap: 14 }}>
          <Cover coverId={story.coverId || 'ink'} style={{ width: 96, height: 132 }} />
          <div className="stack-sm"><h1 className="t-title" style={{ fontSize: 24 }}>{story.title || 'Untitled story'}</h1><p className="t-meta">{story.genre} · {story.language} · {story.status}</p><p className="t-meta">{story.chapters.length} chapters · {readingMinutes(story.chapters)} min</p></div>
        </div>
        <p className="t-body">{story.synopsis}</p>
        {story.chapters.map((c, i) => (
          <section key={c.id}><p className="t-meta">Chapter {i + 1}</p><h2 className="t-h2" style={{ margin: '4px 0 10px' }}>{c.title || 'Untitled chapter'}</h2><div className="preview-body">{c.body || <span className="t-error">This chapter is empty.</span>}</div></section>
        ))}
      </div>
    </Page>
  );
}

/* ---- Publish review ---- */
export function Publish() {
  const { id, story, storyId } = useOwnStory();
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  if (!story) return <NotFoundState what="story" to="/writer/dashboard" />;
  if (story.writerId !== id) return <PermissionDenied />;
  const problems = publishProblems(story);
  const changed = story.chapters.filter((c) => chapterState(story, c.id) !== 'published').length;
  const first = !story.published;
  if (done)
    return (
      <Page title="Published" noBack fallback="/writer/dashboard">
        <div className="empty" style={{ paddingTop: 40 }}>
          <div className="ring" style={{ background: 'var(--dark)', color: '#fff' }}><Ico i={CheckCircle2} size={30} /></div>
          <h1 className="t-title">{story.title} is live</h1>
          <p className="t-meta">Readers can now find it in Discover and on your public profile. Publishing does not verify ownership or rights.</p>
          <div className="stack-sm" style={{ width: '100%', marginTop: 12 }}>
            <LinkButton to={`/story/${storyId}`}>View in Discover</LinkButton>
            <LinkButton variant="secondary" to="/writer/dashboard">Back to studio</LinkButton>
          </div>
        </div>
      </Page>
    );
  return (
    <Page title="Publish review" fallback={`/writer/story/${storyId}/preview`}
      footer={<Button disabled={problems.length > 0 || (!first && !hasUnpublishedChanges(story))} onClick={() => { const r = actions.publish(id, storyId); if (r.ok) setDone(true); else toast(r.message); }}>{first ? 'Publish story' : 'Publish updates'}</Button>}>
      <div className="stack">
        <div className="card stack-sm">
          <div className="kv"><span className="k">Title</span><span className="t-h3">{story.title || '—'}</span></div>
          <div className="kv"><span className="k">Genre · language</span><span>{story.genre || '—'} · {story.language || '—'}</span></div>
          <div className="kv"><span className="k">Status</span><span style={{ textTransform: 'capitalize' }}>{story.status}</span></div>
          <div className="kv"><span className="k">Chapters</span><span>{story.chapters.length} · about {readingMinutes(story.chapters)} min</span></div>
          <div className="kv"><span className="k">Adaptation (live setting)</span><span>{story.adaptationOpen ? 'Open to enquiries' : 'Not open'}</span></div>
        </div>
        <section className="stack-sm" aria-labelledby="chk-h">
          <h2 className="t-h2" id="chk-h">Checks</h2>
          {problems.length === 0 ? <Notice icon={CheckCircle2} tone="ok">Everything required is complete.</Notice> : <Notice icon={AlertCircle} tone="err"><ul className="check-list">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Notice>}
          {!first && <p className="t-meta">{hasUnpublishedChanges(story) ? `${changed} chapter ${changed === 1 ? 'change' : 'changes'} and/or details not yet public.` : 'No unpublished changes.'}</p>}
        </section>
        <Link className="btn-link" to={`/writer/story/${storyId}/chapters`}>Back to chapters</Link>
        <button className="btn-link" onClick={() => navigate(`/writer/story/${storyId}/setup`)}>Edit story details</button>
      </div>
    </Page>
  );
}
