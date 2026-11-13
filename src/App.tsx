import { useEffect, useState } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MobileShell } from './components/Shell';
import { Onboarding } from './screens/Onboarding';
import { Discover } from './screens/Discover';
import { StoryDetails } from './screens/StoryDetails';
import { Contents, Reader, ReadingDone } from './screens/Reader';
import { Library } from './screens/Library';
import { Author } from './screens/Author';
import { Demo, Preferences, Privacy, Profile } from './screens/Profile';
import { ChapterEditor, Chapters, Preview, Publish, StorySetup, WriterDashboard, WriterProfileEdit } from './screens/Writer';
import { EnquiryForm, EnquiryReview, Introduction } from './screens/Filmmaker';
import { Conversation, EnquiryDetail, EnquiryList } from './screens/Enquiries';
import { Home, NotFoundState, RoleOnly, useMe } from './screens/common';
import { SavePrompt } from './components/SavePrompt';
import { BrandSplash, splashSeen } from './screens/BrandSplash';
import { AuthScreen, ForgotPassword, OtpScreen, ResetPassword, Splash } from './screens/Auth';
import { useAuth } from './auth/AuthProvider';
import { isSupabaseConfigured } from './auth/config';
import { onSyncError, useMode } from './store/store';
import { Button } from './components/ui';
import { toast } from './components/Shell';

function Gate({ children }: { children: React.ReactNode }) {
  const { db, id, role } = useMe();
  const { pathname } = useLocation();
  const auth = useAuth();
  const mode = useMode();
  const authPath = pathname.startsWith('/auth');
  if (isSupabaseConfigured && mode === 'account') {
    if (auth.status === 'loading' && !authPath) return <Splash />;
    if (auth.status === 'error')
      return (
        <Splash>
          <p className="t-error">{auth.error}</p>
          <Button onClick={auth.retry}>Try again</Button>
          <Button variant="secondary" onClick={() => void auth.signOut()}>Log out</Button>
        </Splash>
      );
    if (auth.status === 'signedOut' && !authPath) return <Navigate to="/auth" replace />;
    // After a reset code is verified the user must set a new password before anything else.
    if (auth.status === 'recovery' && pathname !== '/auth/reset') return <Navigate to="/auth/reset" replace />;
  }
  if (role === 'reader' && !db.prefs[id]?.onboarded && pathname !== '/welcome' && pathname !== '/profile/demo') return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

const W = ({ children }: { children: React.ReactNode }) => <RoleOnly roles={['writer']}>{children}</RoleOnly>;

/** Android: light status/gesture-bar icons over dark headers, dark icons elsewhere. */
function useSystemBarStyle() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (pathname === '/welcome') return; // onboarding sets its own bar style per step
    const darkTop = pathname === '/discover' || /^\/story\/[^/]+$/.test(pathname);
    void SystemBars.setStyle({ style: darkTop ? SystemBarsStyle.Dark : SystemBarsStyle.Light, bar: SystemBarType.StatusBar }).catch(() => {});
    void SystemBars.setStyle({ style: SystemBarsStyle.Light, bar: SystemBarType.NavigationBar }).catch(() => {});
  }, [pathname]);
}

export default function App() {
  const { id } = useMe();
  useSystemBarStyle();
  useEffect(() => onSyncError(toast), []);
  const [showSplash, setShowSplash] = useState(() => !splashSeen());
  return (
    <MobileShell>
      <SavePrompt />
      {showSplash && <BrandSplash onDone={() => setShowSplash(false)} />}
      <Gate>
        <Routes key={id}>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<AuthScreen />} />
          <Route path="/auth/forgot" element={<ForgotPassword />} />
          <Route path="/auth/reset" element={<ResetPassword />} />
          <Route path="/auth/verify" element={<OtpScreen purpose="signup" />} />
          <Route path="/auth/forgot/code" element={<OtpScreen purpose="recovery" />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/story/:id" element={<StoryDetails />} />
          <Route path="/story/:id/contents" element={<Contents />} />
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
