// Assets exported from the Figma file "Kweb Maker Website" (frames 1.1–1.4: splash, onboarding, genre, language).
import artRead from './art-read.jpg';
import artWrite from './art-write.jpg';
import artAdapt from './art-adapt.jpg';
import logoBook from './logo-open-book.svg';
import logoStroke from './logo-stroke.svg';
import arrowDark from './arrow-dark.svg';
import arrowLight from './arrow-light.svg';
import back from './back.svg';
import checkOn from './check-on.svg';
import checkOff from './check-off.svg';
import langOn from './lang-on.svg';
import langOff from './lang-off.svg';
import mystery from './genre-mystery.svg';
import thriller from './genre-thriller.svg';
import romance from './genre-romance.svg';
import drama from './genre-drama.svg';
import fantasy from './genre-fantasy.svg';
import scifi from './genre-scifi.svg';
import horror from './genre-horror.svg';
import adventure from './genre-adventure.svg';
import historical from './genre-historical.svg';
import humour from './genre-humour.svg';

export const art = { read: artRead, write: artWrite, adapt: artAdapt };
export const logo = { book: logoBook, stroke: logoStroke };
export const ui = { arrowDark, arrowLight, back, checkOn, checkOff, langOn, langOff };
export const genreIcon: Record<string, string> = {
  Mystery: mystery,
  Thriller: thriller,
  Romance: romance,
  Drama: drama,
  Fantasy: fantasy,
  'Science Fiction': scifi,
  Horror: horror,
  Adventure: adventure,
  'Historical Fiction': historical,
  Humour: humour,
};

import hero from './hero.jpg';
import monsoon from './monsoon.jpg';
import unsent from './unsent.jpg';
import frame from './after-frame.jpg';
import iUser from './i-user.svg';
import iProfileCircle from './i-profile-circle.svg';
import iSearch from './i-search.svg';
import iFilterCircle from './i-filter-circle.svg';
import iFilter from './i-filter.svg';
import iArrowSm from './i-arrow-sm.svg';
import iSave from './i-save.svg';
import iDSearch from './i-d-search.svg';
import iDBook from './i-d-book.svg';
import iDCheck from './i-d-check.svg';
import iDClock from './i-d-clock.svg';
import iDArrow from './i-d-arrow.svg';
import navHome from './nav-home.svg';
import navLibrary from './nav-library.svg';
import navWrite from './nav-write.svg';
import navInbox from './nav-inbox.svg';
import navMe from './nav-me.svg';

/** Painted story covers + discover artwork (Figma 1.5 / 02 / 04). */
export const painted: Record<string, string> = { train: hero, unsent, monsoon };
export const artwork = { hero, frame };
export const icons = { user: iUser, profileCircle: iProfileCircle, search: iSearch, filterCircle: iFilterCircle, filter: iFilter, arrowSm: iArrowSm, save: iSave, dSearch: iDSearch, dBook: iDBook, dCheck: iDCheck, dClock: iDClock, dArrow: iDArrow };
export const nav = { home: navHome, library: navLibrary, write: navWrite, inbox: navInbox, me: navMe };
