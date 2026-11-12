import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MobileShell } from './components/Shell';
import { Onboarding } from './screens/Onboarding';
import { Discover } from './screens/Discover';
import { StoryDetails } from './screens/StoryDetails';
import { Reader, ReadingDone } from './screens/Reader';
import { Library } from './screens/Library';
import { Author } from './screens/Author';
import { Demo, Preferences, Privacy, Profile } from './screens/Profile';
import { ChapterEditor, Chapters, Preview, Publish, StorySetup, WriterDashboard, WriterProfileEdit } from './screens/Writer';
import { EnquiryForm, EnquiryReview, Introduction } from './screens/Filmmaker';
import { Conversation, EnquiryDetail, EnquiryList } from './screens/Enquiries';
import { Home, NotFoundState, RoleOnly, useMe } from './screens/common';

function Gate({ children }: { children: React.ReactNode }) {
  const { db, id, role } = useMe();
  const { pathname } = useLocation();
  if (role === 'reader' && !db.prefs[id]?.onboarded && pathname !== '/welcome' && pathname !== '/profile/demo') return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

const W = ({ children }: { children: React.ReactNode }) => <RoleOnly roles={['writer']}>{children}</RoleOnly>;

export default function App() {
  const { id } = useMe();
  return (
    <MobileShell>
      <Gate>
        <Routes key={id}>
          <Route path="/" element={<Home />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/story/:id" element={<StoryDetails />} />
          <Route path="/story/:id/enquire" element={<EnquiryForm />} />
          <Route path="/story/:id/enquire/review" element={<EnquiryReview />} />
          <Route path="/read/:id" element={<Reader />} />
          <Route path="/read/:id/done" element={<ReadingDone />} />
          <Route path="/read/:id/:n" element={<Reader />} />
          <Route path="/library" element={<Library />} />
          <Route path="/author/:id" element={<Author />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/preferences" element={<Preferences />} />
          <Route path="/profile/privacy" element={<Privacy />} />
          <Route path="/profile/demo" element={<Demo />} />
          <Route path="/profile/introduction" element={<Introduction />} />
          <Route path="/profile/writer" element={<W><WriterProfileEdit /></W>} />
          <Route path="/writer/dashboard" element={<W><WriterDashboard /></W>} />
          <Route path="/writer/story/new" element={<W><StorySetup isNew /></W>} />
          <Route path="/writer/story/:id/setup" element={<W><StorySetup /></W>} />
          <Route path="/writer/story/:id/chapters" element={<W><Chapters /></W>} />
          <Route path="/writer/story/:id/chapter/:cid" element={<W><ChapterEditor /></W>} />
          <Route path="/writer/story/:id/preview" element={<W><Preview /></W>} />
          <Route path="/writer/story/:id/publish" element={<W><Publish /></W>} />
          <Route path="/enquiries" element={<EnquiryList />} />
          <Route path="/enquiries/:id" element={<EnquiryDetail />} />
          <Route path="/enquiries/:id/chat" element={<Conversation />} />
          <Route path="*" element={<NotFoundState what="page" />} />
        </Routes>
      </Gate>
    </MobileShell>
  );
}
