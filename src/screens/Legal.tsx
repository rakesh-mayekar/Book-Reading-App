import { useParams } from 'react-router-dom';
import { Page } from '../components/Shell';
import { NotFoundState } from './common';

/** Placeholder policy pages. Replace the copy with your published Terms of use and Privacy policy before release. */
const DOCS = {
  terms: { title: 'Terms of use', body: ['These are draft terms for the Stories prototype.', 'Stories is a reading and writing prototype. Writer and Filmmaker approval grants platform access only. It does not verify identity or prove ownership of a story or adaptation rights.', 'Replace this page with your published Terms of use before release.'] },
  privacy: { title: 'Privacy policy', body: ['This is a draft privacy notice for the Stories prototype.', 'We store your email or phone number to sign you in, plus your reading preferences, bookmarks and reading progress. Writer and filmmaker profiles stay private while they are reviewed.', 'Replace this page with your published Privacy policy before release.'] },
} as const;

export function Legal() {
  const { doc = '' } = useParams();
  const d = DOCS[doc as keyof typeof DOCS];
  if (!d) return <NotFoundState what="page" to="/auth" />;
  return (
    <Page title={d.title} centerTitle fallback="/auth" className="auth">
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>{d.title}</h1>
        <p className="pill pending">Draft placeholder</p>
        {d.body.map((t) => <p key={t} className="fm-val">{t}</p>)}
      </div>
    </Page>
  );
}
