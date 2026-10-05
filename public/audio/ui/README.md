Looma UI sound family
====================

Nine original cues generated with the ElevenLabs Sound Effects skill using
`eleven_text_to_sound_v2`. `manifest.json` records prompts, hashes and durations.
`modal-close.mp3` is a shortened reversed edit of the navigation swoosh.

All clips are mono MP3 at 44.1 kHz / 128 kbps, trimmed to the first meaningful
onset, with 2 ms attack and 15 ms release fades. Source peak is -12 dBFS.
Core clicks/movement last 70–150 ms; success/Pro confirmations 280–340 ms.
The manager applies an additional quiet 18% master gain and per-cue/category gain.
Rate variations are deliberately small. No long reverb or looping audio.

Runtime URLs start at `/audio/ui/`; never include `/public/`.
Generation credentials are only read by the local generation script.

To regenerate, install Python's `elevenlabs` package and FFmpeg/FFprobe, configure
`ELEVENLABS_API_KEY` in the local `.env`, and run:

    python scripts/generate-ui-audio.py

Existing clips are preserved. `--overwrite` explicitly replaces finals using
cached raw generations in `.codex-preview/ui-audio/`. To request a new generation,
move the corresponding cached PCM aside first. `--only click` limits the edit.

Before release, listen through headphones at normal volume using Looma's audio
settings and real interactions. Lower master/cue gains if sound draws attention
away from the interface. Automated waveform checks cannot replace this review.
