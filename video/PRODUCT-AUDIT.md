# Live Looma audit

Inspected the production application at https://looma-feed.vercel.app/ on 5 October 2026.
The capture session used the public, signed-out interface. No production content,
connections, proposals, or messages were created or changed.

| Area | Observed behavior | Editorial decision |
|---|---|---|
| Home/feed | Real posts load; several contain test messages | Frame the working composer; exclude test feed content |
| Composer | Draft entry and Publication/Work selection work | Show composing and type selection; do not depict a successful submission |
| Explore | News, topic list, and real accounts load | Use news and topic discovery with a controlled scroll |
| Explore tabs | Selection indicator changes, much content persists across tabs | Do not imply a separate filtered project feed |
| People/search | Search filters the real account list | Show the official public account and search interaction |
| Opportunities | Two real published opportunities; Design/Marketing filters and text search work | Show Design filter, reset, and search for interface |
| Opportunity details | Toggle label changes; descriptions are short | Prioritize filtering/search instead |
| Public profiles | Official account exists; publication list contains test posts | Use the authentic complete account row in Explore |
| Portfolio, publications | Account sign-in prompts | Excluded from claims of saved/public profile edits |
| Chat/connections | Sign-in prompt, connection/request tabs | Excluded from a working chat story |
| Notifications/proposals | Account sign-in prompts | Excluded |
| Reports | Zero metrics and no-data panel while signed out | Excluded |
| Plans | Free, Basic, Pro copy; disabled plan actions | Excluded from a subscription purchase story |
| Light/dark | Actual sidebar toggle works | Light mode throughout; brief authentic dark reveal in Meet Looma |
| Mobile home | A capture showed the startup layer above the composer | Excluded; vertical composer uses the complete verified desktop component |

The UI in the films is live Looma capture, without generated replacement UI,
seeded fixtures, intercepted data, or redesigned product screens. The surrounding
frames, titles, backgrounds, camera moves, cursor, and transitions are editorial
presentation layers. Browser spelling annotations are suppressed for capture.
