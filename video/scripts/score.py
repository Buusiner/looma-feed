"""Original Looma score. No samples, third-party recordings, or commercial songs."""
from pathlib import Path
import wave
import numpy as np
import subprocess

SR = 48000
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/audio'
OUT.mkdir(parents=True, exist_ok=True)

def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)

def build(name, duration, variant):
    rng = np.random.default_rng(740 + variant)
    audio = np.zeros((int((duration+4)*SR), 2), dtype=np.float64)
    def add(sound, start, level=1, pan=0):
        at = int(start*SR)
        end = min(len(audio), at+len(sound))
        if end <= at: return
        sound = sound[:end-at] * level
        audio[at:end,0] += sound * np.sqrt((1-pan)/2)
        audio[at:end,1] += sound * np.sqrt((1+pan)/2)
    chords = [[48,55,59,64],[52,59,62,67],[45,52,55,60],[41,48,52,57]]
    # Smooth detuned pads, with a slow attack and no vocal layer.
    for bar in range(6):
        notes = chords[(bar + variant) % 4]
        t = np.arange(int(5.4*SR))/SR
        env = np.minimum(t/0.85,1) * np.minimum((5.4-t)/1.25,1)
        for i,note in enumerate(notes):
            hz = frequency(note+12)
            pad = (np.sin(2*np.pi*hz*t) + .28*np.sin(2*np.pi*hz*1.002*t+.8) + .12*np.sin(2*np.pi*hz*2*t)) * env
            add(pad,bar*4,.032,(-.45,.35,-.25,.5)[i])
    # Rounded marimba-like plucks, with stereo echoes.
    patterns = [[72,76,79,83,79,76,74,79],[76,79,83,86,83,79,76,74],[69,72,76,79,76,72,71,76],[65,69,72,76,72,69,67,72]]
    for step in range(int(duration*2)):
        time = step*.5
        note = patterns[(step//8+variant)%4][step%8]
        t = np.arange(int(1.5*SR))/SR
        hz = frequency(note)
        pluck = (np.sin(2*np.pi*hz*t) + .24*np.sin(2*np.pi*hz*2*t)*np.exp(-t*12)) * np.minimum(t/.006,1)*np.exp(-t*5.2)
        pan = .25*np.sin(step*1.7)
        level = .070 if step%2==0 else .046
        add(pluck,time,level,pan)
        add(pluck,time+.375,level*.22,-pan)
        add(pluck,time+.75,level*.09,pan)
    # Restrained pulse and deep sine bass.
    for step in range(int(duration*2)):
        start = step*.5
        t = np.arange(int(.38*SR))/SR
        phase = 2*np.pi*(48*t + 30*.035*(1-np.exp(-t/.035)))
        kick = np.sin(phase)*np.minimum(t/.002,1)*np.exp(-t*13)
        add(kick,start,.11 if step%2==0 else .046)
        if step%2==1:
            noise=rng.normal(size=len(t)); noise=np.convolve(noise,np.ones(5)/5,mode='same')
            rim=(.4*np.sin(2*np.pi*850*t)+noise*.22)*np.exp(-t*55)*np.minimum(t/.003,1)
            add(rim,start,.027,.1)
    for bar in range(6):
        t=np.arange(int(3.75*SR))/SR
        note=chords[(bar+variant)%4][0]-12
        bass=np.sin(2*np.pi*frequency(note)*t)*np.minimum(t/.03,1)*np.minimum((3.75-t)/.2,1)
        add(bass,bar*4,.055)
    # Soft UI accents at editorial beats. Kept below the instrumental.
    for cut in [2,6,10,14,duration-2]:
        t=np.arange(int(.55*SR))/SR
        noise=rng.normal(size=len(t)); airy=np.convolve(noise,np.ones(40)/40,mode='same')
        env=np.sin(np.pi*np.minimum(t/.55,1))**2
        add(airy*env,cut-.25,.012,-.25)
    audio=audio[:int(duration*SR)]
    t=np.arange(len(audio))/SR
    fade=np.minimum(t/.6,1)*np.minimum((duration-t)/1.5,1)
    audio *= fade[:,None]
    audio=np.tanh(audio*1.8)
    source=OUT/f'{name}-original.wav'
    with wave.open(str(source),'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((audio*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(source),'-af','loudnorm=I=-18:TP=-2:LRA=7','-ar','48000','-c:a','pcm_s16le',str(OUT/f'{name}.wav')],check=True)
    print(f'Original score: {name}, {duration}s, stereo 48 kHz, -18 LUFS target')

build('meet',20,0)
build('opportunities',18,1)
build('presence',18,2)
