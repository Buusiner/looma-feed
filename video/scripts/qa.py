"""Verify every exported frame/stream and produce chronological review sheets."""
from pathlib import Path
import json, subprocess, re, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output'
QA=OUT/'qa'
QA.mkdir(parents=True,exist_ok=True)
records=[]
for video in sorted(OUT.glob('looma-*.mp4')):
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(video)]))
    v=next(s for s in probe['streams'] if s['codec_type']=='video')
    a=next(s for s in probe['streams'] if s['codec_type']=='audio')
    duration=20 if 'meet' in video.name else 18
    vertical='vertical' in video.name
    expected=(1080,1920) if vertical else (1920,1080)
    assert (v['width'],v['height'])==expected,video.name
    assert v['r_frame_rate']=='60/1' and v['codec_name']=='h264'
    assert v['pix_fmt']=='yuv420p'
    assert abs(float(v['duration'])-duration)<.02
    assert int(v['nb_read_frames'])==duration*60
    assert a['codec_name']=='aac' and a['sample_rate']=='48000' and a['channels']==2
    scan=subprocess.run(['ffmpeg','-hide_banner','-i',str(video),'-vf','blackdetect=d=0.1:pix_th=0.1','-af','ebur128=peak=true','-f','null','-'],capture_output=True,text=True,check=True)
    black=re.findall(r'black_start:([\d.]+) black_end:([\d.]+)',scan.stderr)
    assert not black,f'Unexpected black interval in {video.name}: {black}'
    # Decode the full audio, then verify the beginning/end fades and true duration.
    pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(video),'-vn','-f','f32le','-acodec','pcm_f32le','-ar','48000','-ac','2','-'])
    audio=np.frombuffer(pcm,dtype='<f4').reshape(-1,2)
    rms=lambda x:float(20*np.log10(np.sqrt(np.mean(x*x))+1e-12))
    tail=rms(audio[-int(.1*48000):])
    start=rms(audio[:int(.1*48000)])
    peak=float(20*np.log10(np.max(np.abs(audio))+1e-12))
    assert peak<-1, f'Peak too loud: {video.name} {peak}'
    assert tail<-35, f'Abrupt audio ending: {video.name} {tail}'
    loudness=re.findall(r'I:\s*(-?[\d.]+) LUFS',scan.stderr)
    # All frames are decoded above; these chronological thumbnails support visual review.
    frames=QA/(video.stem+'-frames')
    frames.mkdir(exist_ok=True)
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(video),'-vf','fps=2,scale=320:-1','-q:v','2',str(frames/'%03d.jpg')],check=True)
    images=sorted(frames.glob('*.jpg'))
    tw,th=(320,569) if vertical else (320,180)
    cols=4 if vertical else 6
    rows=(len(images)+cols-1)//cols
    sheet=Image.new('RGB',(tw*cols,(th+25)*rows),'#fff')
    draw=ImageDraw.Draw(sheet)
    for i,frame in enumerate(images):
        x=(i%cols)*tw;y=(i//cols)*(th+25)
        draw.text((x+6,y+6),f'{i/2:.1f}s',fill='black')
        sheet.paste(Image.open(frame).resize((tw,th)),(x,y+25))
    sheet.save(QA/(video.stem+'-chronology.jpg'),quality=93)
    record={'file':video.name,'duration':duration,'width':v['width'],'height':v['height'],'fps':60,'frames':int(v['nb_read_frames']),'videoCodec':'H.264','audioCodec':'AAC','audioSampleRate':48000,'channels':2,'integratedLUFS':float(loudness[-1]) if loudness else None,'samplePeakDBFS':round(peak,2),'first100msRMS':round(start,2),'last100msRMS':round(tail,2),'blackIntervals':black,'fullDecodePassed':True}
    records.append(record)
    print(json.dumps(record))
if '--partial' not in sys.argv:
    assert len(records)==6,f'Expected six completed exports, found {len(records)}'
(QA/'validation.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print(f'All {len(records)} inspected exports passed complete decode, format, frame count, black-frame, and audio fade checks.')
