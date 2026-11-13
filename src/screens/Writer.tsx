import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, BookOpen, Camera, Check, CheckCircle2, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { art, icons } from '../assets/figma';
import { BottomSheet, ConfirmModal } from '../components/Dialog';
import { RichText } from '../components/RichText';
import { Page, toast, useBack } from '../components/Shell';
import { Avatar, Button, Chip, Cover, EmptyState, Ico, IconButton, LinkButton, Notice, Switch, TextArea, TextField } from '../components/ui';
import { chapterState, hasUnpublishedChanges, publishProblems, readingMinutes, validateStoryMeta } from '../domain/rules';
import { COVER_IDS, GENRES, LANGUAGES, type Story } from '../domain/types';
import { actions, retryPersist, usePersistOk } from '../store/store';
import { NotFoundState, PermissionDenied, useMe } from './common';

const ORD = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];

function useOwnStory() {
  const { id: storyId = '' } = useParams();
  const me = useMe();
  const story = me.db.stories.find((s) => s.id === storyId);
  return { ...me, story, storyId };
}
type Pill = { label: string; cls: string };
const pillFor = (s: Story): Pill => (!s.published ? { label: 'Draft', cls: '' } : hasUnpublishedChanges(s) ? { label: 'Changes pending', cls: 'pending' } : { label: 'Published', cls: 'live' });
const draftMeta = (s: Story) => (!s.published ? `${s.chapters.length} draft ${s.chapters.length === 1 ? 'chapter' : 'chapters'} · Not published` : `${s.status === 'completed' ? 'Completed' : 'Ongoing'} · Public · Free`);

/* ---- Writing desk ---- */
export function WriterDashboard() {
  const { db, id, name } = useMe();
  const mine = db.stories.filter((s) => s.writerId === id).sort((a, b) => b.updatedAt - a.updatedAt);
  const drafts = mine.filter((s) => !s.published).length;
  const pub = mine.length - drafts;
  const pending = db.enquiries.filter((e) => e.writerId === id && e.status === 'pending').length;
  return (
    <Page nav noBack header={<header className="lib-head"><h1>Your writing desk</h1><span className="wd-who">{name}</span></header>}>
      <p className="lib-sub">A little space for your next story.</p>
      <div className="stack" style={{ gap: 24 }}>
        <div className="wd-stats" aria-label="Your stories at a glance">
          <div><b data-testid="stat-stories">{mine.length}</b><span>Stories</span></div>
          <div><b data-testid="stat-published">{pub}</b><span>Published</span></div>
          <div><b data-testid="stat-draft">{drafts}</b><span>Draft</span></div>
        </div>
        <LinkButton to="/writer/story/new" arrow>Start a new story</LinkButton>
        <section aria-labelledby="ys">
          <h2 className="lib-h" id="ys">Your stories</h2>
          {mine.length ? (
            <div className="stack" style={{ gap: 16 }}>
              {mine.map((s) => {
                const p = pillFor(s);
                return (
                  <Link key={s.id} to={`/writer/story/${s.id}/chapters`} className="wd-row">
                    <Cover coverId={s.coverId} style={{ width: 72, height: 104, borderRadius: 8 }} />
                    <span><span className={`pill ${p.cls}`}>{p.label}</span><b>{s.title || 'Untitled story'}</b><small>{draftMeta(s)}</small></span>
                  </Link>
                );
              })}
            </div>
          ) : <EmptyState icon={BookOpen} title="No stories yet" text="Start a story and it will be saved here as a private draft until you publish." />}
        </section>
        <Link to="/enquiries" className="wd-enq"><Ico i={BookOpen} size={24} /><span><b>Adaptation enquiries</b><small>{pending ? `${pending} pending ${pending === 1 ? 'request' : 'requests'} in Inbox` : 'Review requests in Inbox'}</small></span></Link>
      </div>
    </Page>
  );
}

/* ---- Writer profile ---- */
export function WriterProfileEdit() {
  const { db, id } = useMe();
  const navigate = useNavigate();
  const w = db.writers[id];
  const [name, setName] = useState(w?.name ?? '');
  const [bio, setBio] = useState(w?.bio ?? '');
  const [langs, setLangs] = useState<string[]>(w?.languages ?? ['English']);
  const [photo, setPhoto] = useState(w?.photo);
  const [tried, setTried] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const errors = { name: name.trim().length < 2 ? 'Enter your writing name.' : '', bio: bio.trim().length < 20 ? 'Write at least 20 characters about yourself.' : bio.length > 400 ? 'Keep it under 400 characters.' : '' };
  const onFile = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setPhotoErr('Choose an image file.');
    if (f.size > 150_000) return setPhotoErr('Choose an image under 150 KB.');
    const r = new FileReader();
    r.onload = () => { setPhoto(String(r.result)); setPhotoErr(''); };
    r.readAsDataURL(f);
  };
  const toggle = (l: string) => setLangs((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]));
  return (
    <Page noBack={false} fallback="/profile" title="Write" footer={<Button arrow onClick={() => { setTried(true); if (errors.name || errors.bio) return; actions.saveWriterProfile({ id, name: name.trim(), bio: bio.trim(), photo, languages: langs }); toast('Profile saved'); navigate('/writer/dashboard', { replace: true }); }}>{w ? 'Save writer profile' : 'Create writer profile'}</Button>}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="stack-sm"><h1 className="t-title">Every voice has<br />a beginning.</h1><p className="t-meta">Set up the name readers will know you by.</p></div>
        <img className="wp-banner" src={art.write} alt="" />
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={name || 'W'} photo={photo} size={56} />
          <div className="stack-sm">
            <label className="btn btn-secondary" style={{ height: 44, cursor: 'pointer' }}><Ico i={Camera} size={18} /> Choose photo<input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} /></label>
            {photo && <button className="btn-link" onClick={() => setPhoto(undefined)}>Remove photo</button>}
          </div>
        </div>
        {photoErr ? <p className="t-error" role="alert">{photoErr}</p> : <p className="t-help">Optional. Stored only on this device.</p>}
        <TextField label="Writing name *" value={name} onChange={setName} error={tried ? errors.name : ''} autoComplete="off" />
        <TextArea label="About you · Optional" value={bio} onChange={setBio} error={tried ? errors.bio : ''} help={`${bio.length}/400 · shown on your public profile`} />
        <fieldset className="field"><legend className="label">Languages you write in</legend><div className="chips">{LANGUAGES.map((l) => <Chip key={l} selected={langs.includes(l)} onClick={() => toggle(l)}>{l}</Chip>)}</div></fieldset>
      </div>
    </Page>
  );
}

/* ---- Story setup ("Set the scene.") ---- */
export function StorySetup({ isNew }: { isNew?: boolean }) {
  const { id, story } = useOwnStory();
  const navigate = useNavigate();
  const [f, setF] = useState(() => ({
    title: story?.title ?? '', synopsis: story?.synopsis ?? '', genre: story?.genre ?? '', language: story?.language ?? '', coverId: story?.coverId ?? COVER_IDS[0],
    status: story?.status ?? ('ongoing' as Story['status']), adaptationOpen: story?.adaptationOpen ?? false,
  }));
  const [tried, setTried] = useState(false);
  const [covers, setCovers] = useState(false);
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
  return (
    <Page centerTitle title={isNew ? 'New story' : 'Story setup'} fallback="/writer/dashboard" footer={<Button arrow onClick={save}>{isNew ? 'Save & add chapters' : 'Save changes'}</Button>}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="stack-sm"><h1 className="t-title">Set the scene.</h1><p className="t-meta">Start with the details readers will see.</p></div>
        <div className="ss-cover">
          <Cover coverId={f.coverId} style={{ width: 88, height: 116, borderRadius: 8 }} />
          <div><b>Story cover</b><p>Choose an image that belongs to your story.</p><button className="btn-link" onClick={() => setCovers(true)}>Change cover</button></div>
        </div>
        <TextField label="Story title *" value={f.title} onChange={(v) => set('title', v)} error={tried ? errors.title : ''} maxLength={80} />
        <TextArea label="Synopsis *" value={f.synopsis} onChange={(v) => set('synopsis', v)} error={tried ? errors.synopsis : ''} help="Two or three sentences readers see first." />
        <SelectField label="Genre *" value={f.genre} options={GENRES} onChange={(v) => set('genre', v)} error={tried ? errors.genre : ''} />
        <SelectField label="Story language *" value={f.language} options={LANGUAGES} onChange={(v) => set('language', v)} error={tried ? errors.language : ''} />
        <div className="switch-row">
          <div><span className="t-h3" style={{ display: 'block' }}>Open to adaptation enquiries</span><span className="t-help">Declared by you. It is not proof of rights, and it only affects new enquiries once saved.</span></div>
          <Switch label="Open to adaptation enquiries" checked={f.adaptationOpen} onChange={(v) => set('adaptationOpen', v)} />
        </div>
      </div>
      <BottomSheet open={covers} onClose={() => setCovers(false)} title="Choose a cover">
        <div className="cover-picker" role="radiogroup" aria-label="Cover">
          {COVER_IDS.map((c) => (
            <button type="button" key={c} role="radio" aria-checked={f.coverId === c} aria-label={`Cover ${c}`} className="cover-option" onClick={() => { set('coverId', c); setCovers(false); }}>
              <Cover coverId={c} style={{ width: '100%', aspectRatio: '3/4' }} />
              {f.coverId === c && <span className="tick"><Ico i={Check} size={14} /></span>}
            </button>
          ))}
        </div>
      </BottomSheet>
    </Page>
  );
}

function SelectField({ label, value, options, onChange, error }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; error?: string }) {
  const sid = useMemo(() => `sel-${label.replace(/\W+/g, '')}`, [label]);
  return (
    <div className="field">
      <label htmlFor={sid}>{label}</label>
      <select id={sid} className="input select" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}>
        <option value="">Choose…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <p className="t-error" role="alert">{error}</p>}
    </div>
  );
}

/* ---- Chapter manager ---- */
export function Chapters() {
  const { id, story, storyId } = useOwnStory();
  const navigate = useNavigate();
  const [del, setDel] = useState<string | null>(null);
  if (!story) return <NotFoundState what="story" to="/writer/dashboard" />;
  if (story.writerId !== id) return <PermissionDenied />;
  const published = !!story.published;
  const pending = hasUnpublishedChanges(story);
  const CS = { published: 'Published · Visible to everyone', changed: 'Draft changes · Not published', new: 'Draft · Not published' };
  const canReview = story.chapters.length > 0 && (!published || pending);
  return (
    <Page centerTitle title="Chapters" fallback="/writer/dashboard"
      footer={<><Button arrow disabled={!canReview} onClick={() => navigate(`/writer/story/${storyId}/preview`)}>{!published ? 'Review for publishing' : pending ? 'Review changes' : 'No new chapters to publish'}</Button>{story.chapters.length === 0 && <p className="t-help" style={{ textAlign: 'center' }}>Add a chapter to review and publish.</p>}</>}>
      <div className="stack" style={{ gap: 20 }}>
        <h1 className="t-title">{story.title || 'Untitled story'}</h1>
        <p className="t-meta">{published ? (pending ? 'Published story · changes pending' : 'Published story') : 'Draft story'} · {story.language} · {story.genre}</p>
        <div className="note">
          <b>{published ? (story.chapters.every((c) => chapterState(story, c.id) === 'published') ? 'Your story is live.' : 'Readers see your last published version.') : 'Only you can see this draft.'}</b>
          <p>{published ? 'New chapters and edits stay private until you publish.' : 'Nothing goes live until you review and publish.'}</p>
        </div>
        <ol className="cm-list">
          {story.chapters.map((c, i) => (
            <li key={c.id} className="cm-card">
              <Link to={`/writer/story/${storyId}/chapter/${c.id}`}>
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                <span><b>{c.title || 'Untitled chapter'}</b><small>{CS[chapterState(story, c.id)]}</small></span>
              </Link>
              <div className="cm-tools">
                <IconButton icon={ArrowUp} label={`Move chapter ${i + 1} up`} disabled={i === 0} onClick={() => actions.moveChapter(storyId, c.id, -1)} tone="ghost" />
                <IconButton icon={ArrowDown} label={`Move chapter ${i + 1} down`} disabled={i === story.chapters.length - 1} onClick={() => actions.moveChapter(storyId, c.id, 1)} tone="ghost" />
                <IconButton icon={Trash2} label={`Delete chapter ${i + 1}`} onClick={() => setDel(c.id)} tone="ghost" />
              </div>
            </li>
          ))}
        </ol>
        {story.chapters.length === 0 && <p className="t-help">No chapters yet. Add your first one to start writing.</p>}
        <button className="cm-add" onClick={() => navigate(`/writer/story/${storyId}/chapter/${actions.addChapter(storyId)}`)}><Ico i={Plus} size={24} /><span>Add a chapter</span></button>
        <p className="t-help">Keep chapters in reading order. You can come back and continue writing anytime.</p>
        <LinkButton variant="secondary" arrow to={`/writer/story/${storyId}/preview`}>Preview story</LinkButton>
        <div className="switch-row">
          <div><span className="t-h3" style={{ display: 'block' }}>Open to adaptation enquiries</span><span className="t-help">Applies immediately to new enquiries. Existing enquiries are not affected.</span></div>
          <Switch label="Open to adaptation enquiries" checked={story.adaptationOpen} onChange={(v) => { actions.updateStory(storyId, { adaptationOpen: v }); toast(v ? 'Now open to enquiries' : 'No longer open to new enquiries'); }} />
        </div>
        <LinkButton variant="secondary" to={`/writer/story/${storyId}/setup`}>Edit story details</LinkButton>
      </div>
      <ConfirmModal open={!!del} destructive title="Delete this chapter?" confirmLabel="Delete chapter" onCancel={() => setDel(null)} onConfirm={() => { if (del) actions.deleteChapter(storyId, del); setDel(null); toast('Chapter deleted'); }}
        body="The chapter is removed from your draft. If it was already published, readers keep seeing it until you publish again." />
    </Page>
  );
}

/* ---- Chapter editor with toolbar and debounced autosave ---- */
export function ChapterEditor() {
  const { cid = '' } = useParams();
  const { id, story, storyId } = useOwnStory();
  const chapter = story?.chapters.find((c) => c.id === cid);
  const [title, setTitle] = useState(chapter?.title ?? '');
  const [body, setBody] = useState(chapter?.body ?? '');
  const [state, setState] = useState<'idle' | 'saved' | 'dirty' | 'saving'>(chapter?.title || chapter?.body ? 'saved' : 'idle');
  const persistOk = usePersistOk();
  const latest = useRef({ title, body });
  const dirty = useRef(false);
  const timer = useRef<number>();
  const area = useRef<HTMLTextAreaElement>(null);
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
  if (!story || !chapter) return <NotFoundState what="chapter" to="/writer/dashboard" />;
  if (story.writerId !== id) return <PermissionDenied />;
  const index = story.chapters.findIndex((c) => c.id === cid);
  const empty = !title.trim() && !body.trim();

  const apply = (kind: 'b' | 'i' | 'h' | 'l') => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: z, value } = el;
    let next = value;
    let caret = z;
    if (kind === 'b' || kind === 'i') {
      const mark = kind === 'b' ? '**' : '*';
      const raw = value.slice(a, z) || (kind === 'b' ? 'bold text' : 'italic text');
      // wrap each non-empty line separately so formatting never spans a paragraph break
      const sel = raw.split('\n').map((l) => (l.trim() ? l.replace(/^(\s*)(.*?)(\s*)$/, `$1${mark}$2${mark}$3`) : l)).join('\n');
      next = value.slice(0, a) + sel + value.slice(z);
      caret = a + sel.length;
    } else {
      const start = value.lastIndexOf('\n', a - 1) + 1;
      const end = z === a ? (value.indexOf('\n', a) === -1 ? value.length : value.indexOf('\n', a)) : z;
      const prefix = kind === 'h' ? '# ' : '- ';
      const lines = value.slice(start, end).split('\n');
      const all = lines.every((l) => l.startsWith(prefix));
      const out = lines.map((l) => (all ? l.slice(prefix.length) : prefix + l)).join('\n');
      next = value.slice(0, start) + out + value.slice(end);
      caret = start + out.length;
    }
    setBody(next);
    edit(title, next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };
  const status = !persistOk
    ? <button className="ce-fail" onClick={() => { flush(); retryPersist(); }}><TriangleAlert size={16} aria-hidden="true" /> Changes not saved · Retry</button>
    : state === 'dirty' ? <span>Unsaved changes…</span> : state === 'saving' ? <span>Saving…</span> : state === 'saved' ? <span><Check size={16} aria-hidden="true" /> All changes saved</span> : <span><Check size={16} aria-hidden="true" /> No changes yet</span>;
  return (
    <Page className="ce" centerTitle title={`Chapter ${index + 1}`} fallback={`/writer/story/${storyId}/chapters`} onBack={() => { flush(); navigate(`/writer/story/${storyId}/chapters`, { replace: true }); }}
      right={<Link to={`/writer/story/${storyId}/preview?c=${cid}`} className={`ce-preview ${empty ? 'off' : ''}`} aria-disabled={empty} onClick={(e) => { if (empty) e.preventDefault(); else flush(); }}>Preview</Link>}
      footer={<><p className="ce-note">{!persistOk ? 'Text retained here. Retry before leaving.' : story.published && chapterState(story, cid) !== 'new' ? 'Published · edits stay private until you publish' : 'Draft · Visible only to you'}</p>
        <Button arrow disabled={empty} onClick={() => { flush(); navigate(`/writer/story/${storyId}/preview?c=${cid}`); }}>Preview chapter</Button></>}>
      <div className="ce-body">
        <p className="ce-status" role="status" data-testid="save-state" aria-live="polite">{status}</p>
        <label className="sr-only" htmlFor="ch-title">Chapter title</label>
        <input id="ch-title" className="ce-title" placeholder="Chapter title" value={title} maxLength={90} onChange={(e) => { setTitle(e.target.value); edit(e.target.value, body); }} />
        <div className="ce-tools" role="toolbar" aria-label="Formatting">
          <button aria-label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('b')}><b>B</b></button>
          <button aria-label="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('i')}><i>I</i></button>
          <button aria-label="Heading" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('h')}>Heading</button>
          <button aria-label="List" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('l')}>List</button>
        </div>
        <label className="sr-only" htmlFor="ch-body">Chapter text</label>
        <textarea id="ch-body" ref={area} className="ce-text" placeholder="Start writing your next chapter…" value={body} onChange={(e) => { setBody(e.target.value); edit(title, e.target.value); }} />
      </div>
    </Page>
  );
}

/* ---- Reader preview ---- */
export function Preview() {
  const { id, story, storyId } = useOwnStory();
  const [params] = useSearchParams();
  const back = useBack(`/writer/story/${storyId}/chapters`);
  if (!story) return <NotFoundState what="story" to="/writer/dashboard" />;
  if (story.writerId !== id) return <PermissionDenied />;
  const only = params.get('c');
  const list = story.chapters.map((c, i) => ({ c, i })).filter(({ c }) => !only || c.id === only);
  return (
    <Page centerTitle title="Reader preview" fallback={`/writer/story/${storyId}/chapters`} onBack={back} className="preview"
      footer={<LinkButton arrow to={`/writer/story/${storyId}/publish`}>Review for publishing</LinkButton>}>
      <span className="pill" style={{ alignSelf: 'flex-start' }}>Private preview</span>
      <p className="t-help" style={{ margin: '12px 0 20px' }}>{only ? 'This is how your chapter will read.' : 'This is how your story will read.'} It is not published yet.</p>
      {!only && (
        <div className="row" style={{ gap: 14, marginBottom: 24, alignItems: 'flex-start' }}>
          <Cover coverId={story.coverId} style={{ width: 72, height: 104, borderRadius: 8 }} />
          <div className="stack-sm"><h1 className="t-h2">{story.title || 'Untitled story'}</h1><p className="t-meta">{story.genre} · {story.language} · {story.chapters.length} chapters · {readingMinutes(story.chapters)} min</p><p className="t-body">{story.synopsis}</p></div>
        </div>
      )}
      {list.map(({ c, i }) => (
        <article key={c.id} style={{ marginBottom: 32 }}>
          <p className="r-eyebrow" style={{ marginTop: 0 }}>CHAPTER {ORD[i] ?? i + 1}</p>
          <h2 className="r-title" style={{ fontSize: 30 }}>{c.title || 'Untitled chapter'}</h2>
          <div className="prose" data-spacing="1" style={{ fontSize: 18 }}>{c.body.trim() ? <RichText text={c.body} /> : <p className="t-error">This chapter is empty.</p>}</div>
        </article>
      ))}
    </Page>
  );
}

/* ---- Publish review ---- */
export function Publish() {
  const { id, story, storyId, name: authorName } = useOwnStory();
  const [done, setDone] = useState(false);
  const [rights, setRights] = useState(false);
  const back = useBack(`/writer/story/${storyId}/preview`);
  if (!story) return <NotFoundState what="story" to="/writer/dashboard" />;
  if (story.writerId !== id) return <PermissionDenied />;
  const problems = publishProblems(story);
  const first = !story.published;
  const changed = hasUnpublishedChanges(story);
  const n = story.chapters.length;
  if (done)
    return (
      <Page centerTitle title="Published" noBack fallback="/writer/dashboard" footer={<LinkButton arrow to="/writer/dashboard">Back to writing desk</LinkButton>}>
        <div className="stack" style={{ gap: 20 }}>
          <div className="pub-check"><Ico i={Check} size={32} /></div>
          <div className="stack-sm"><h1 className="t-title">Your story is live.</h1><p className="t-meta">A new story has found its beginning.</p></div>
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <Cover coverId={story.coverId} style={{ width: 88, height: 128, borderRadius: 8 }} />
            <div className="stack-sm"><span className="pill live">Published</span><h2 className="t-h2" style={{ fontSize: 24, lineHeight: '32px' }}>{story.title}</h2><p className="t-meta">{story.status === 'completed' ? 'Completed' : 'Ongoing'} · {n === 1 ? 'Chapter 1 is public' : `${n} chapters are public`}</p></div>
          </div>
          <p className="t-body muted">Keep writing the next chapter. New drafts stay private until you publish them. Publishing does not verify ownership or rights.</p>
          <LinkButton variant="secondary" arrow to={`/writer/story/${storyId}/chapters`}>Keep writing</LinkButton>
          <LinkButton variant="secondary" to={`/story/${storyId}`}>View in Discover</LinkButton>
        </div>
      </Page>
    );
  const can = problems.length === 0 && rights && (first || changed);
  return (
    <Page centerTitle title="Publish story" fallback={`/writer/story/${storyId}/preview`} onBack={back}
      footer={<Button arrow disabled={!can} onClick={() => { const r = actions.publish(id, storyId); if (r.ok) setDone(true); else toast(r.message); }}>{first ? 'Publish story' : 'Publish updates'}</Button>}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="stack-sm"><h1 className="t-title">{first ? <>Ready for your<br />first readers?</> : <>Ready to publish<br />your changes?</>}</h1><p className="t-meta">Review what will become public.</p></div>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <Cover coverId={story.coverId} style={{ width: 72, height: 104, borderRadius: 8 }} />
          <div className="stack-sm"><h2 className="t-h2" style={{ fontSize: 22, lineHeight: '28px' }}>{story.title || 'Untitled story'}</h2><p className="t-meta">by {authorName}</p><p className="t-meta">{story.genre || '—'} · {story.language || '—'}</p></div>
        </div>
        <ul className="pub-checks">
          {problems.length === 0 ? <>
            <li><Ico i={Check} size={22} /> Story details complete</li>
            <li><Ico i={Check} size={22} /> {n} {n === 1 ? 'chapter' : 'chapters'} ready to publish</li>
          </> : problems.map((p) => <li key={p} className="bad"><Ico i={TriangleAlert} size={20} /> {p}</li>)}
          {!first && !changed && <li><Ico i={CheckCircle2} size={22} /> No unpublished changes</li>}
        </ul>
        <div className="field"><span className="label" id="st-l">Story status</span>
          <div className="chips" role="radiogroup" aria-labelledby="st-l">{(['ongoing', 'completed'] as const).map((s) => <Chip radio key={s} selected={story.status === s} onClick={() => actions.updateStory(storyId, { status: s })}>{s === 'ongoing' ? 'Ongoing' : 'Completed'}</Chip>)}</div></div>
        <div className="stack-sm"><p className="pub-label">ADAPTATION</p><p className="t-h3">{story.adaptationOpen ? 'Open to enquiries' : 'Not open to enquiries'}</p><p className="t-help">You can change this in story settings.</p></div>
        <div className="stack-sm"><p className="t-meta">Public · Free to read</p><p className="t-meta">{first ? `Only ${n === 1 ? 'chapter 1' : `these ${n} chapters`} will go live. Future drafts stay private.` : 'Changes go live when you publish. Future drafts stay private.'}</p></div>
        <label className="pub-confirm"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /><span className="box" aria-hidden="true"><Ico i={Check} size={16} /></span><span>I confirm I have the rights to publish this story.</span></label>
        <p className="t-help">This is your own confirmation. Stories does not verify ownership or rights.</p>
      </div>
    </Page>
  );
}
void icons;
