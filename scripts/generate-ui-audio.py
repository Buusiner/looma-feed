"""Generate Looma's nine core cues with ElevenLabs, then make short quiet edits.

Requires: pip install elevenlabs; ffmpeg and ffprobe on PATH.
Reads ELEVENLABS_API_KEY from .env/environment, never from VITE_* variables.
Raw generations are cached outside public in .codex-preview/ui-audio.
Existing finals are preserved unless --overwrite is explicitly passed.
"""
from array import array
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import argparse
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
LOCAL_SDK = ROOT / ".codex-preview/audio-python"
if LOCAL_SDK.exists():
    sys.path.insert(0, str(LOCAL_SDK))
from elevenlabs import ElevenLabs

CORE = {
    "click": (0.070, "One tiny soft synthetic fingertip tick, rounded dry transient, quiet felt-like tap with a trace of digital texture. Total event 60 milliseconds."),
    "primary-click": (0.115, "One rounded warm soft low-mid pop impact, satisfying restrained tactile confirmation, gently deeper than a fingertip tick. Total event 100 milliseconds."),
    "pop": (0.095, "One light rounded delicate high-pitched synthetic bubble pop, warm clean digital pluck, subtle and friendly. Total event 80 milliseconds."),
    "navigation-swoosh": (0.145, "One very short silky airy directional swish, soft filtered breath of movement, no dramatic wind or bass. Total event 130 milliseconds."),
    "message-sent": (0.135, "One short soft outgoing airy swoosh, gently rising filtered air with a tiny rounded start, restrained forward movement. Total event 120 milliseconds."),
    "notification": (0.150, "One quiet clean rounded glass pling, soft single digital pluck, gentle brightness with a very fast decay. Total event 140 milliseconds."),
    "success": (0.280, "Exactly two small soft rounded glass-pluck notes ascending a gentle musical interval, first note immediately then second after 90 milliseconds, warm positive confirmation. Complete within 250 milliseconds."),
    "error": (0.085, "One muted low soft warm impact, rounded felt-like thump with gentle low frequency body, calm discreet negative feedback. Total event 70 milliseconds. No buzzer, alarm, distortion or harshness."),
    "premium-pro-chime": (0.340, "One restrained crystalline two-note shimmer, tiny soft glass plucks with a gentle upward sparkle, polished expensive product confirmation, quiet and delicate. Complete within 300 milliseconds."),
}
STYLE = (
    "Looma premium OS UI. Isolated event starts at zero, then silence. "
    "Soft synthetic, warm rounded, delicate glass palette. Dry, quiet. "
    "No speech, music, background, arcade, ringtone, reverb or echo. "
)


def run(*args):
    return subprocess.run(args, check=True, capture_output=True).stdout


def edit(raw, name, duration, output, reverse=False):
    samples = array("h", raw.read_bytes())
    if sys.byteorder != "little":
        samples.byteswap()
    peak = max(abs(value) for value in samples)
    if peak < 50:
        raise RuntimeError(f"{name}: generated audio is silent")
    # Use a 3ms energy window to reject dither and trim leading silence.
    window = 132
    threshold = max(25, peak * 0.035)
    onset = next((i for i in range(0, len(samples) - window, window)
                  if math.sqrt(sum(value * value for value in samples[i:i + window]) / window) > threshold), 0)
    onset = max(0, onset - 88)
    take = list(samples[onset:onset + round(duration * 44100)])
    take += [0] * max(0, round(duration * 44100) - len(take))
    if reverse:
        take.reverse()
    # Every source peaks at -12 dBFS BEFORE the manager's quiet master gain.
    scale = (32767 * 10 ** (-12 / 20)) / max(abs(value) for value in take)
    fade_in, fade_out = 88, 662
    processed = array("h", (round(value * scale * min(1, i / fade_in) * min(1, (len(take) - 1 - i) / fade_out)) for i, value in enumerate(take)))
    if sys.byteorder != "little":
        processed.byteswap()
    wav = raw.with_name(name + "-edited.wav")
    with wave.open(str(wav), "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(44100)
        stream.writeframes(processed.tobytes())
    temporary = raw.with_name(name + "-encoded.mp3")
    run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-map_metadata", "-1", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", str(temporary))
    probe = json.loads(run("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(temporary)))
    stream = probe["streams"][0]
    assert stream["codec_name"] == "mp3" and stream["channels"] == 1 and stream["sample_rate"] == "44100"
    shutil.copyfile(temporary, output)
    return {"file": output.name, "duration_ms": round(duration * 1000), "container_duration_ms": round(float(probe["format"]["duration"]) * 1000), "peak_dbfs": -12, "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--only", choices=list(CORE))
    args = parser.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("ffmpeg and ffprobe must be installed")
    env = {}
    env_file = ROOT / ".env"
    for line in (env_file.read_text(encoding="utf-8") if env_file.exists() else "").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('\"').strip("'")
    key = env.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("Configure ELEVENLABS_API_KEY locally; do not expose it in Vite")
    cache = ROOT / ".codex-preview/ui-audio"
    cache.mkdir(parents=True, exist_ok=True)
    output = ROOT / "public/audio/ui"
    output.mkdir(parents=True, exist_ok=True)

    def generate(item):
        name, (duration, prompt) = item
        final = output / f"{name}.mp3"
        if final.exists() and not args.overwrite:
            print(f"Preserved {name}", flush=True)
            return None
        raw = cache / f"{name}.pcm"
        if not raw.exists():
            client = ElevenLabs(api_key=key, timeout=120)
            audio = client.text_to_sound_effects.convert(text=STYLE + prompt, duration_seconds=0.5, prompt_influence=0.85, model_id="eleven_text_to_sound_v2", output_format="pcm_44100", loop=False)
            raw.write_bytes(b"".join(audio))
        metadata = edit(raw, name, duration, final)
        metadata["prompt"] = STYLE + prompt
        print(f"Prepared {name}: {metadata['duration_ms']}ms", flush=True)
        return metadata

    selected = [(name, spec) for name, spec in CORE.items() if not args.only or args.only == name]
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = [result for result in pool.map(generate, selected) if result]
    close = output / "modal-close.mp3"
    if (cache / "navigation-swoosh.pcm").exists() and (not close.exists() or args.overwrite):
        results.append({**edit(cache / "navigation-swoosh.pcm", "modal-close", 0.100, close, reverse=True), "derived_from": "navigation-swoosh", "edit": "reversed shortened movement"})
    manifest = output / "manifest.json"
    previous = json.loads(manifest.read_text()) if manifest.exists() else {"generator": "ElevenLabs eleven_text_to_sound_v2", "sample_rate": 44100, "channels": 1, "sounds": []}
    changed = {result["file"] for result in results}
    previous["sounds"] = [sound for sound in previous["sounds"] if sound["file"] not in changed] + results
    manifest.write_text(json.dumps(previous, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
