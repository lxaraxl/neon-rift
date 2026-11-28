"""Bake Neon Rift's articulated frames. Run from the repository with Pillow, NumPy, and a C++17 compiler."""
import argparse
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import ctypes
import math
import re
import subprocess
import tempfile

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'art/miniatures'
OUTPUT = ROOT / 'art/combat'
HERO_SIZE = (192, 204, 150, 175)
CREATURE_SIZE = (144, 153, 111, 131)
WIDTH, HEIGHT, BODY, FOOT = HERO_SIZE
FRAMES, COLS = 24, 8
GROUPS = {
    'rest': ('idle',),
    'motion': ('walk', 'run', 'fly'),
    'clash': ('attack', 'block', 'hit'),
    'power': ('ult', 'stun', 'victory', 'die'),
}
# Signs are screen directions in the artwork, before mirroring.
FRONT_LEFT = {'cipher'}
BACK_LEFT = {'bastion', 'cipher', 'grom', 'kairos', 'lyra', 'mila', 'nyx', 'pixel', 'raven', 'scrap', 'tesla', 'zhar'}
# Most hats, halos and weapon tips extend above the anatomical top of the head.
HEAD = {'astra':.31, 'glitch':.31, 'pyro':.36, 'sol':.29, 'mila':.32, 'kairos':.27,
        'raven':.27, 'rain':.31, 'phoenix':.30, 'volta':.29, 'lyra':.27, 'murr':.28}
HIPS = {'astra':.72, 'glitch':.69, 'kairos':.68, 'raven':.68, 'pyro':.72,
        'silas':.65, 'scrap':.66, 'mila':.64, 'pixel':.66, 'nyx':.69}
Y, X = np.mgrid[:HEIGHT, :WIDTH].astype(np.float32)
RASTERIZE = None

def load_rasterizer(path):
    global RASTERIZE
    library=ctypes.CDLL(str(path))
    RASTERIZE=library.rasterize
    pointer=np.ctypeslib.ndpointer(dtype=np.float32,flags='C_CONTIGUOUS')
    RASTERIZE.argtypes=[pointer,pointer,pointer,pointer,ctypes.c_int,ctypes.c_int]
    RASTERIZE.restype=None


def ease(t):
    t = min(1, max(0, t))
    return t*t*(3-2*t)


def impulse(q, start, peak, end):
    return ease((q-start)/(peak-start)) * (1-ease((q-peak)/(end-peak)))


def center(alpha, lo, hi, fallback):
    rows = alpha[round(len(alpha)*lo):round(len(alpha)*hi)] > 80
    _, xs = np.nonzero(rows)
    return float(np.median(xs)) if len(xs) else fallback


def setup(path, hero, view, direction):
    image = Image.open(path).convert('RGBA')
    image = image.crop(image.getchannel('A').getbbox())
    image.thumbnail((round(WIDTH*.82), BODY), Image.Resampling.LANCZOS)
    alpha = np.asarray(image.getchannel('A'))
    foot_center = center(alpha, .94, 1, image.width/2)
    x = round(WIDTH/2-foot_center)
    y = FOOT-image.height
    padded = Image.new('RGBA', (WIDTH, HEIGHT))
    padded.paste(image, (x,y))
    rgba = np.asarray(padded, dtype=np.float32)
    rgba[:,:,:3] *= rgba[:,:,3:4]/255
    # The pelvis and neck follow the figure, even for off-center weapons and capes.
    head = HEAD.get(hero,.27)
    hip = HIPS.get(hero,.69)
    neck = head+.15
    torso_x = x+center(alpha, neck-.04,neck+.08,foot_center)
    hip_x = x+center(alpha,hip-.05,hip+.03,foot_center)
    head_x = x+center(alpha,head-.09,head+.09,foot_center)
    profile = view in ('left','right')
    spread = BODY*(.042 if profile else .111)
    boots=None
    if profile:
        feet=(alpha[-max(5,round(image.height*.10)):] > 127).sum(axis=0)>=3
        edges=np.flatnonzero(np.diff(np.r_[False,feet,False]))
        clusters=[(a+b-1)/2+x for a,b in zip(edges[::2],edges[1::2]) if b-a>=BODY*.075]
        if len(clusters)==2:
            boots=clusters
    shoulder_y = y+image.height*(neck+.055)
    hip_y = y+image.height*hip
    # Each control has its own falloff. Hands and boots can move in opposite directions.
    controls = [
        (head_x,y+image.height*head,.15,.14),
        (torso_x,shoulder_y,.118,.10),
        (hip_x,hip_y,.13,.105),
    ]
    for side in (-1,1):
        controls.extend([
            (torso_x+side*spread,shoulder_y,.064,.065),
            (torso_x+side*(spread+.031*BODY), shoulder_y+.10*BODY,.064,.070),
            (torso_x+side*(spread+.072*BODY), shoulder_y+.183*BODY,.088,.096),
            (hip_x+side*spread*.64,hip_y+.11*BODY,.060,.065),
            ((boots[(side+1)//2] if boots else WIDTH/2+side*spread*.85),FOOT-.039*BODY,.072,.069),
            (hip_x+side*(spread+.102*BODY),hip_y+.08*BODY,.076,.133),
        ])
    # Smooth skinning weights for the mesh. Translucent hair and cloth share the outer controls.
    weights = []
    for px,py,rx,ry in controls:
        distance = ((X-px)/(rx*BODY))**2+((Y-py)/(ry*BODY))**2
        weights.append(np.exp(-distance*.5))
    weights = np.asarray(weights,dtype=np.float32)
    gait_weights=weights.copy()
    far_leg=None
    if profile and not boots:
        # The profile sheet hides the far boot. Skin the visible boot as one limb
        # and place a shaded copy behind the body for the opposite stride.
        rear=3 if direction>0 else 9
        taper=np.clip((Y-(FOOT-.33*BODY))/(.24*BODY),0,1)
        gait_weights[rear+3]*=1-.94*taper
        gait_weights[rear+4]*=1-.98*taper
        source=np.array(padded,dtype=np.float32)
        px=WIDTH/2
        mask=np.clip(1-(np.abs(X-px)-BODY*.052)/(BODY*.052),0,1)
        mask*=np.clip((Y-(FOOT-.25*BODY))/(BODY*.075),0,1)
        source[:,:,:3]*=.72
        source[:,:,3]*=mask
        far_leg=Image.fromarray(np.rint(source).astype(np.uint8))
    weights /= np.maximum(weights.sum(axis=0), .0001)
    gait_weights /= np.maximum(gait_weights.sum(axis=0), .0001)
    arm_pivots = [
        (torso_x+side*spread*.63, shoulder_y+.015*BODY) for side in (-1,1)
    ]
    arm_masks = []
    for side,(px,py) in zip((-1,1),arm_pivots):
        # The forearm and weapon should turn as a unit. The seam blends at the shoulder.
        leg_zone=np.clip((Y-hip_y)/(.22*BODY),0,1)
        outer=np.clip((side*(X-torso_x)/BODY+.012-.13*leg_zone)/.11,0,1)
        below = np.clip(((Y-py)/BODY+.03)/.16,0,1)
        above_boots = np.clip((FOOT+.012*BODY-Y)/(.20*BODY),0,1)
        mask = outer*below*above_boots
        arm_masks.append(mask.astype(np.float32))
    return rgba, weights, gait_weights, arm_pivots, arm_masks, far_leg


def pose(action,q,style,direction,shape):
    # Coordinates are measured in units of character height.
    # Timed positions are authored for the head, torso, pelvis, arms, knees, boots and cloth.
    wave, strut = math.sin(2*math.pi*q), math.cos(2*math.pi*q)
    weight = .82 if style=='tank' else 1
    lead = 1 if direction>0 else -1
    root_x = root_y = tilt = arm_x = arm_y = guard = stride = crouch = fabric = rise = fall = 0.
    arm_x_other = arm_y_other = lead_turn = support_turn = 0.
    if action=='idle':
        root_y=-.010*wave
        tilt=.013*wave
        arm_y=.014*wave
        arm_y_other=-.007*wave
        fabric=.023*math.sin(2*math.pi*q+.75)
    elif action in ('walk','run','fly'):
        length = {'walk':.092,'run':.128,'fly':.059}[action]
        stride=length*wave
        root_y=(-.008 if action!='fly' else -.068)-length*(.13*abs(strut)+.04*strut)
        tilt=direction*length*.34
        arm_x=-stride*.72
        arm_x_other=stride*.68
        arm_y=-abs(stride)*.18+length*.11*strut
        arm_y_other=-abs(stride)*.15-length*.115*strut
        lead_turn=-stride*2.6
        support_turn=stride*2.2
        fabric=-direction*length*.48+wave*.018
    elif action=='attack':
        wind=impulse(q,0,.21,.43)
        strike=impulse(q,.22,.42,.92)
        root_x=direction*(-.053*wind+.069*strike)*weight
        crouch=.059*wind
        tilt=direction*(-.082*wind+.102*strike)
        if style=='war':
            arm_x=direction*(-.125*wind+.218*strike)
            arm_y=-.175*wind-.102*strike
            lead_turn=direction*(.57*wind-1.03*strike)
            support_turn=direction*.24*strike
            arm_x_other=-direction*.087*strike
            arm_y_other=-.08*wind+.06*strike
        elif style=='tank':
            arm_x=direction*(-.06*wind+.185*strike)
            arm_y=-.065*wind-.091*strike
            arm_y_other=-.11*wind
            lead_turn=direction*(.38*wind-.72*strike)
        elif style in ('arch','mage'):
            arm_x=direction*(-.058*wind+(.163 if style=='arch' else .194)*strike)
            arm_y=-.112*wind-.161*strike
            arm_x_other=direction*.058*strike
            arm_y_other=-.119*wind-.059*strike
            lead_turn=-direction*(.27*wind+.77*strike)
            support_turn=-direction*.35*strike
            tilt*=.70
        else:
            arm_x=direction*(.045*wind+.127*strike)
            arm_y=-.149*wind-.237*strike
            arm_x_other=-direction*.060*wind
            arm_y_other=-.176*strike
            lead_turn=-direction*.81*strike
            support_turn=direction*.31*strike
        stride=(.034*wind+.052*strike)*direction
        follow=impulse(q,.48,.73,1)
        arm_y_other += .068*follow
        root_y += .022*follow
        fabric=direction*(.075*wind-.115*strike+.079*follow)
    elif action=='block':
        guard=impulse(q,0,.25,1)
        root_x=-direction*.037*guard
        crouch=.067*guard
        tilt=-direction*.069*guard
        arm_x=direction*.125*guard
        arm_x_other=direction*.091*guard
        arm_y=-.145*guard
        arm_y_other=-.125*guard
        lead_turn=-direction*.93*guard
        support_turn=-direction*.45*guard
        recover=impulse(q,.24,.57,1)
        support_turn += direction*.28*recover
        arm_y_other += .063*recover
        fabric=-direction*(.046*guard+.056*recover)
    elif action=='hit':
        force=impulse(q,0,.18,1)
        root_x=-direction*.085*force
        crouch=.055*force
        tilt=-direction*.17*force
        arm_x=-direction*.093*force
        arm_y=-.101*force
        arm_y_other=-.041*force
        stride=-direction*.073*force
        settle=impulse(q,.19,.47,1)
        arm_y_other += .08*settle
        tilt += direction*.048*settle
        fabric=-direction*(.15*force-.063*settle)
    elif action=='ult':
        charge=impulse(q,0,.32,.60)
        release=impulse(q,.29,.61,1)
        rise=.088*release
        crouch=.043*charge
        tilt=direction*(-.086*charge+.072*release)
        arm_x=direction*(-.118*charge+.247*release)
        arm_y=-.242*charge-.183*release
        arm_x_other=-direction*(.092*charge+.143*release)
        arm_y_other=-.158*charge-.225*release
        lead_turn=direction*(.4*charge-1.04*release)
        support_turn=direction*.76*release
        fabric=-direction*.142*release
    elif action=='stun':
        tilt=wave*.092
        crouch=.035+.018*wave
        arm_x=.031*wave
        arm_y=-.063*(.5+.5*wave)
        fabric=-wave*.035+strut*.007
        arm_y_other=strut*.031
    elif action=='victory':
        salute=impulse(q,.04,.38,.94)
        tilt=direction*.024*wave
        rise=.023*salute
        arm_x=direction*.075*salute
        arm_y=-.218*salute
        arm_y_other=-.094*salute
        lead_turn=-direction*.94*salute
        fabric=.042*wave+strut*.018
    elif action=='die':
        fall=ease(q)
        root_x=-direction*.117*fall
        crouch=.115*fall
        tilt=-direction*.26*fall
        arm_x=-direction*.15*fall
        arm_y=.099*fall
        arm_x_other=direction*.054*fall
        arm_y_other=.137*fall
        fabric=-direction*.078*fall
    # Independent arms, grounded boots, and secondary cloth follow-through.
    body_y = root_y+crouch-rise
    offsets = [
        (root_x+tilt,body_y+crouch*.22),
        (root_x+tilt*.63,body_y),
        (root_x+tilt*.16,body_y*.64),
    ]
    for side in (-1,1):
        reach,lift=(arm_x,arm_y) if side==lead else (arm_x_other,arm_y_other)
        step=side*stride
        step_lift=-max(0,side*strut)*(.112 if action=='run' else .080) if action in ('run','walk','fly') else 0
        offsets.extend([
            (root_x+tilt*.58+reach*.22,body_y+lift*.22),
            (root_x+tilt*.43+reach*.57,body_y+lift*.61),
            (root_x+tilt*.30+reach,body_y+lift),
            (root_x*.46+step*.64,body_y*.42+step_lift*.74),
            (step,step_lift+rise*-.63+fall*.015),
            (root_x*.72+tilt*.26+fabric,body_y*.52+lift*.14),
        ])
    rotation = (support_turn, lead_turn) if lead>0 else (lead_turn, support_turn)
    if shape=='slime':
        flatten = .09*(impulse(q,0,.22,1) if action in ('attack','block','hit') else .5+.5*wave)
        offsets = [(dx*.56+x*flatten,dy*.65+(.92-y)*flatten)
                   for (dx,dy),(x,y) in zip(offsets,[(0,.23),(0,.44),(0,.65)]+[
                       (side*(.45+i*.08), .43+i*.10) for side in (-1,1) for i in range(6)])]
        rotation = (0,0)
    elif shape in ('bat','dragon','bird','moth'):
        flight = .15*wave if action in ('idle','walk','run','fly') else -.18*impulse(q,.04,.39,.92)
        for first in (3,9):
            for idx,force in zip((first,first+1,first+2,first+5),(.22,.64,1,.68)):
                dx,dy=offsets[idx]
                offsets[idx]=(dx,dy+flight*force)
    return np.array(offsets,dtype=np.float32)*BODY, rotation


def render(rgba, weights, offsets, pivots, masks, rotations, fall, direction):
    dx=np.einsum('i,ijk->jk',offsets[:,0],weights,optimize=False)
    dy=np.einsum('i,ijk->jk',offsets[:,1],weights,optimize=False)
    for (px,py),mask,angle in zip(pivots,masks,rotations):
        if abs(angle)<.01:
            continue
        c,s=math.cos(angle)-1,math.sin(angle)
        ax,ay=X-px,Y-py
        dx += (c*ax-s*ay)*mask
        dy += (s*ax+c*ay)*mask
    tx,ty=X+dx,Y+dy
    if fall:
        # The stagger turns into a grounded diagonal collapse.
        angle=-direction*.48*fall
        c,s=math.cos(angle),math.sin(angle)
        ax=tx-WIDTH*.5; ay=ty-FOOT
        tx=WIDTH*.5+ax*c-ay*s+direction*fall*BODY*.11
        ty=FOOT+ax*s+ay*c
    image=np.zeros_like(rgba)
    RASTERIZE(rgba,tx,ty,image,WIDTH,HEIGHT)
    image[:,:,:3]*=255/np.maximum(image[:,:,3:4],1)
    image[[0,-1],:]=0;image[:,[0,-1]]=0
    return Image.fromarray(np.clip(np.rint(image),0,255).astype(np.uint8))


def build(job):
    global WIDTH, HEIGHT, BODY, FOOT, Y, X
    path,hero,view,style,shape,selected=job
    WIDTH, HEIGHT, BODY, FOOT=HERO_SIZE if shape=='hero' else CREATURE_SIZE
    Y, X=np.mgrid[:HEIGHT, :WIDTH].astype(np.float32)
    direction=-1 if view=='left' or view.startswith('front') and hero in FRONT_LEFT or view.startswith('back') and hero in BACK_LEFT else 1
    rgba,weights,gait_weights,pivots,masks,far_leg=setup(path,hero,view,direction)
    for group,actions in GROUPS.items():
        if group not in selected: continue
        atlas=Image.new('RGBA',(COLS*WIDTH,len(actions)*3*HEIGHT))
        for row,action in enumerate(actions):
            for i in range(FRAMES):
                q=i/(FRAMES-1 if action=='die' else FRAMES)
                offsets,rotations=pose(action,q,style,direction,shape)
                locomotion=action in ('walk','run')
                frame=render(rgba,gait_weights if locomotion else weights,offsets,pivots,masks,rotations,ease(q) if action=='die' else 0,direction)
                if locomotion and far_leg:
                    rear=7 if direction>0 else 13
                    dx,dy=offsets[rear]
                    # The angle pivots above the knee; the landing follows the opposite foot phase.
                    angle=math.degrees(math.atan2(dx,BODY*.33))
                    foot=far_leg.rotate(angle,Image.Resampling.BICUBIC,
                                        center=(WIDTH*.5,FOOT-BODY*.26),translate=(-3*direction,float(dy)))
                    foot.alpha_composite(frame)
                    frame=foot
                atlas.paste(frame,(i%COLS*WIDTH,(row*3+i//COLS)*HEIGHT))
        atlas.save(OUTPUT/f'{hero}-{view}-{group}.webp',quality=82,method=3,alpha_quality=78)


def bake_turns(jobs):
    views=('front','front-alt','back','back-alt','left','right')
    for hero,shape in sorted({(hero,shape) for _,hero,_,_,shape in jobs}):
        width,height,*_=HERO_SIZE if shape=='hero' else CREATURE_SIZE
        active=views if shape=='hero' else ('front',)
        sheet=Image.new('RGBA',(width//2*len(active),height//2))
        for i,view in enumerate(active):
            with Image.open(OUTPUT/f'{hero}-{view}-rest.webp') as rest:
                first=rest.crop((0,0,width,height)).resize((width//2,height//2),Image.Resampling.LANCZOS)
                sheet.paste(first,(i*width//2,0))
        sheet.save(OUTPUT/f'{hero}-turn.webp',quality=88,method=3)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hero',action='append',help='Only build the named hero (repeatable)')
    parser.add_argument('--creatures-only',action='store_true')
    parser.add_argument('--turns-only',action='store_true',help='Build the compact turn previews from rest frames')
    parser.add_argument('--group',action='append',choices=GROUPS,help='Only rebake this clip group')
    parser.add_argument('--jobs',type=int,default=4)
    args=parser.parse_args()
    html=(ROOT/'index.html').read_text()
    classes=dict(re.findall(r"\{id:'([a-z]+)',name:'[^']+',rar:'[^']+',el:'[^']+',cls:'([^']+)'",html))
    jobs=[]
    if not args.creatures_only:
        for path in sorted(SOURCES.glob('*.webp')):
            hero,view=path.stem.split('-',1)
            if not args.hero or hero in args.hero:
                jobs.append((path,hero,view,classes[hero],'hero'))
    if not args.hero:
        mobs = {'bat':'war','golem':'tank','ghost':'mage','slime':'tank','bot':'arch'}
        for mon,style in mobs.items():
            jobs.append((ROOT/'art'/f'enemy_{mon}.webp',f'mob-{mon}','front',style,mon))
        companions = dict(re.findall(r"\{id:'([a-z]+)',name:'[^']+',rar:'[^']+',shape:'([^']+)'",html))
        for pet,shape in companions.items():
            jobs.append((ROOT/'art'/f'sprite_{pet}.webp',f'companion-{pet}','front','sup',shape))
    assert jobs, 'No matching miniature files'
    OUTPUT.mkdir(exist_ok=True)
    if args.turns_only:
        bake_turns(jobs)
        return
    with tempfile.TemporaryDirectory() as tmp:
        library=Path(tmp)/'rasterizer.so'
        subprocess.run(['c++','-O3','-std=c++17','-shared','-fPIC',
                        str(Path(__file__).with_name('skin-rasterizer.cpp')),
                        '-o',str(library)],check=True)
        with ProcessPoolExecutor(args.jobs,initializer=load_rasterizer,initargs=(library,)) as pool:
            for i,_ in enumerate(pool.map(build,((*job,tuple(args.group or GROUPS)) for job in jobs)),1):
                if i==len(jobs) or i%6==0:
                    print(f'{i}/{len(jobs)} directions baked',flush=True)
    if not args.group or 'rest' in args.group:
        bake_turns(jobs)



if __name__=='__main__':
    main()
