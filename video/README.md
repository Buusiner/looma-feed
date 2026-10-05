# Looma product films

Three completed product stories, in landscape and deliberately reframed vertical editions:

| Film | Duration | Demonstrates |
|---|---:|---|
| Meet Looma | 20 s | Discovery, opportunities, draft composer, brief light-to-dark theme reveal |
| Discover opportunities | 18 s | Explore topics, working Design filter/reset, opportunity search |
| Build your presence | 18 s | Real public account discovery, composing an idea, Publication/Work selection |

Landscape: 1920 × 1080, 60 fps. Vertical: 1080 × 1920, 60 fps.
All final files are H.264 MP4, yuv420p, with AAC stereo audio at 48 kHz / 256 kbps.
Light mode is the primary look; only Meet Looma includes a short dark-mode demonstration.

## Watch and download

Open `output/index.html` to play the six finished films. The MP4s are in `output/`.
The chronological review sheets and full-stream validation are in `output/qa/`.

## Edit

This is an isolated Remotion project. The application files and existing user changes
were preserved. No commits, pushes, or published history changes were made.

```powershell
cd D:\Documentos\looma-feed\video
npm ci
npm run dev -- --port=3002
```

Studio: http://localhost:3002
The Landscape and Vertical folders contain the final films. Editable-Scenes contains
standalone scene timelines. The authored scene nodes, timings, captions, and composition
registrations are in `src/Root.tsx`. Reusable frame/cursor/branding components are in
`src/components/`; scenes are in `src/scenes/`.

## Rebuild

```powershell
npm run render
npm run qa
```

`render.mjs` bundles once, renders each of the six registered films, and preserves a
render manifest. It uses the local Playwright Chromium executable. On another machine,
set `LOOMA_CHROME` to an installed Chromium executable. FFmpeg and FFprobe must be on
PATH for capture, audio normalization, and QA. Rendered output can be reproduced from
the preserved capture assets without logging in to Looma.

## Refresh the live capture

```powershell
npm run capture
```

Completed capture files are reused. Set `LOOMA_RECAPTURE` to comma-separated names such
as `wide-discover,wide-people` to refresh selected captures. The capture script drives
the real production interface using Playwright, at device scale factor 2, and advances
the browser clock frame by frame for 60 fps JPEG capture. The screenshot frames are
encoded at CRF 15. No fictional product UI or intercepted response data is used.
See `PRODUCT-AUDIT.md` for the inspected screens and editorial decisions.

The vertical films use responsive opportunity/people captures and complete desktop
component crops for discovery/composing and the light/dark comparison. They are separate
compositions, with titles and product regions placed explicitly for portrait viewing.

## Audio and typography

The three scores were composed locally using sine-based pads, rounded plucks, restrained
percussion, bass, stereo echoes, and subtle transition accents. No third-party samples,
commercial tracks, or vocals were used. The WAVs are replaceable layers in `src/Root.tsx`.
Each original score is normalized to a target of -18 LUFS / -2 dBTP and includes gentle
fades. Rebuild with `python scripts/score.py` (NumPy required).

Inter is bundled locally from Google Fonts; its OFL license is preserved alongside the
font files in `public/assets/branding/Inter-LICENSE.txt`. Looma's mark is copied from the
application's existing SVG and uses the actual black/cream/lime presentation.

The final delivery uses Rec.709 video colour. Unconverted first-pass Remotion masters are preserved in output/masters/. The optional scripts/finalize.mjs converts completed older full-range masters while preserving their AAC tracks.

