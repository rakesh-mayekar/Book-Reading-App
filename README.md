# Book-Reading-App — Stories App prototype

Mobile-only web prototype (fixed 390px canvas) covering Reader, Writer and Filmmaker roles, adaptation enquiries and conversations.
React + TypeScript + Vite + React Router; shared store persisted in localStorage (versioned).

## Run
```
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # unit tests for enquiry transitions & permissions
npm run e2e        # browser journeys (needs dev server + Google Chrome)
```

## Demo accounts
Profile → Demo controls: Riya Shah (Reader), Mira Sen (Writer), Kabir Mehta (Filmmaker). Reset restores seed data.

## Prototype rules / limitations
- Authentication, moderation, message delivery and rights verification are simulated locally. Reports are local records only.
- Declined/withdrawn enquiries cannot be reopened; a new enquiry may be started if the story is open and no block applies.
- Availability is a live writer setting (not part of the published snapshot). Acceptance does not grant adaptation rights.
- Sample writers (Arjun, Neha, Samir) have no demo login, so enquiries to them stay pending.
- Visual matching is based on the written spec; the Figma file was not accessible.
