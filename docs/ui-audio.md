Looma UI audio
=============

`src/lib/audio-manager.ts` exports the only audio engine. The root mounts one
`UIAudio` bridge; components never create Howls. It preloads files on the client
and waits for a trusted pointer/keyboard gesture before playback. Locked,
unloaded, missing and hidden-page sounds are dropped without later replay.

Global UI volume, mute, category gains (0 disables) and the reduced-motion policy
are saved per device and synced between tabs. UI gain never alters video/media
volume. Sounds are silent by default when the system requests reduced motion;
users can override that in Configurações. Browsers do not expose a reliable OS
mute preference; the output device and browser still control final audibility.

Core files live in `public/audio/ui/` and use root-relative `/audio/ui/*.mp3`
URLs. No extra Vite plugins or client generation credentials are needed.

For an explicit action use:

    import { audioManager } from "@/lib/audio-manager";
    audioManager.play("save"); // after persistence succeeds

For declarative click feedback use `data-ui-sound="like"`, `"save"`, `"premium"`
or any cue in `ui-sound-catalog.ts`. Use `data-ui-sound="none"` to suppress the
generic delegated click when a handler provides its own feedback. Mark primary
buttons `data-ui-primary`. Avoid binding sounds to text inputs, hover, scrolling,
pointer movement, polling/count changes or automatic route/theme updates.

Nine cores supply click, primary, navigation, like, save, follow, messageSent,
messageReceived, success, error, warning, remove, menu, modalOpen/Close,
notification, toggleOn/Off, themeDark/Light and premium variants. Follow uses a
warm pop followed by a very quiet pling; warning uses two low pulses.

Clicks peak with a 120 ms visual compression at 32 ms. Navigation/tab cues start
with selection/movement and use restrained directional stereo positioning.
Shared modal/sheet/menu cues start on the CSS animation event, including reverse
closing motion. Async outcomes sound when confirmed and deletion sounds start
when the feed's exit animation starts. Meaningful confirmations take priority
over movement/clicks. A single active voice, per-cue cooldowns, a 65 ms global
guard and cancellable sequences prevent rapid-click audio spam.

Current flows wire publishing, editing, deletion, connection requests/acceptance,
proposal sending/responding, profile saving, onboarding and settings. This
version of Looma has no interactive like/bookmark/Pro checkout controls or chat
view; their cues are available through the same API for those future flows.
Proposal notifications use the received bloop; other new notifications use the
pling. Historical notifications remain silent. Apply the accompanying
`20261005140000_enable_notification_audio_realtime.sql` migration to enable
live notification inserts on deployments where Realtime isn't already enabled.

Generation and asset provenance are described in `public/audio/ui/README.md`.
Listening with headphones remains a release check; automated tests validate
levels/timing and browser behavior but do not judge perceived comfort.
