# Zvukové logo Contineo (jingle): šesť tónov paličkového nástroja so zvončekom,
# na konci tichý akord C dur a dozvuk. Skladba je tu, nie v ElevenLabs, aby
# melódia bola presne daná a dala sa kedykoľvek znova vyrobiť.
# python3 jingle.py <výstup.wav>   (vybraná melódia m1, rozhodnutie Jána 29. 10. 2026)
import numpy as np, wave, sys
SR=48000
def hz(n):  # n = MIDI
    return 440*2**((n-69)/12)
N={'C4':60,'D4':62,'E4':64,'F4':65,'G4':67,'A4':69,'B4':71,'C5':72,'D5':74,'E5':76,'F5':77,'G5':79,'A5':81,'B5':83,'C6':84,'D6':86,'E6':88}
def mallet(f,d,v):
    t=np.arange(int(SR*d))/SR
    env=np.exp(-t*5.5)*(1-np.exp(-t*600))
    s=np.sin(2*np.pi*f*t)+0.35*np.sin(2*np.pi*f*4*t)*np.exp(-t*18)+0.12*np.sin(2*np.pi*f*10*t)*np.exp(-t*40)
    return v*env*s
def bell(f,d,v):
    t=np.arange(int(SR*d))/SR
    mod=np.sin(2*np.pi*f*3.5*t)*2.2*np.exp(-t*6)
    return v*0.35*np.exp(-t*3.2)*(1-np.exp(-t*800))*np.sin(2*np.pi*f*2*t+mod)
def pad(fs,d,v):
    t=np.arange(int(SR*d))/SR
    env=np.minimum(t/0.25,1)*np.exp(-t*1.4)
    return v*env*sum(np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*f*2.003*t) for f in fs)/len(fs)
def render(notes, chord, bpm, out):
    beat=60/bpm; total=sum(b for _,b,_ in notes)*beat+2.0
    x=np.zeros(int(SR*total)); pos=0.0
    for n,b,v in notes:
        if n:
            i=int(pos*SR); s=mallet(hz(N[n]),1.6,v)+bell(hz(N[n]),1.6,v)
            x[i:i+len(s)]+=s[:len(x)-i]
        pos+=b*beat
    last=pos-notes[-1][1]*beat
    p=pad([hz(N[c]) for c in chord],2.0,0.35); i=int(last*SR); x[i:i+len(p)]+=p[:len(x)-i]
    # dozvuk: konvolúcia so zoslabujúcim sa šumom
    rng=np.random.default_rng(7); ir=rng.standard_normal(int(SR*1.2))*np.exp(-np.arange(int(SR*1.2))/SR*4.5)
    wet=np.convolve(x,ir)[:len(x)]; wet/=np.abs(wet).max()+1e-9
    y=x/np.abs(x).max()*0.8+wet*0.18
    y/=np.abs(y).max(); y*=0.89
    fade=int(SR*0.3); y[-fade:]*=np.linspace(1,0,fade)
    st=np.stack([y,y],1); w=wave.open(out,'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st*32767).astype(np.int16).tobytes()); print(out, f"{total:.1f}s")
# (tón, dĺžka v dobách, sila): otázka vystúpi hore, odpoveď sa vráti dole na základný tón
M1=[('G4',.5,.8),('C5',.5,.85),('E5',.5,.9),('G5',1,1),('E5',.5,.85),('C5',2,1)]
render(M1,['C4','G4','E5'],132,sys.argv[1] if len(sys.argv)>1 else 'jingle.wav')
