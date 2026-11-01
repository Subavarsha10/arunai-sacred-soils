"""Generates the local SVG artwork (products, categories, hero, logo).
Run:  python generate_images.py   (optional - the generated files are already included)
Replace any file with a real photo later and update the 'image' path in js/api.js (or via Admin > Products)."""
import math, random, os
BASE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(BASE, 'images')

def svg(w, h, body, c1, c2):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/>'
            f'<stop offset="1" stop-color="{c2}"/></linearGradient></defs><rect width="{w}" height="{h}" fill="url(#bg)"/>{body}</svg>')

def table(w=600, h=450, color='#C9A878'):
    return f'<rect y="{h*0.72}" width="{w}" height="{h*0.28}" fill="{color}" opacity=".55"/>'
def shadow(cx, cy, rx):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{rx*0.16}" fill="#000" opacity=".16"/>'

def tomato(cx, cy, r, col='#D6392B'):
    leaves = ''.join(f'<ellipse cx="{cx}" cy="{cy-r*.88}" rx="{r*.07}" ry="{r*.22}" fill="#3E7C3A" transform="rotate({a} {cx} {cy-r*.82})"/>' for a in (0, 72, 144, 216, 288))
    return (shadow(cx, cy+r, r*.9) + f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{col}"/>'
            f'<ellipse cx="{cx-r*.38}" cy="{cy-r*.35}" rx="{r*.2}" ry="{r*.11}" fill="#fff" opacity=".35" transform="rotate(-35 {cx-r*.38} {cy-r*.35})"/>' + leaves)

def carrot(x, y, ln, ang):
    lines = ''.join(f'<path d="M-14 {ln*k} h{14+k*2}" stroke="#C86A12" stroke-width="2" opacity=".6"/>' for k in (.2, .4, .6))
    leaves = ''.join(f'<ellipse cx="{dx}" cy="-34" rx="7" ry="30" fill="#4C8A3A" transform="rotate({a} {dx} -4)"/>' for dx, a in ((-10, -22), (0, 0), (10, 22)))
    return f'<g transform="translate({x} {y}) rotate({ang})">{leaves}<path d="M-20 -4 Q0 -14 20 -4 L0 {ln} Z" fill="#F08A24"/>{lines}</g>'

def coconut_whole(cx, cy, r):
    hair = ''.join(f'<path d="M{cx+math.cos(a)*r*.2} {cy+math.sin(a)*r*.2} L{cx+math.cos(a)*r*.95} {cy+math.sin(a)*r*.95}" stroke="#4E3520" stroke-width="2" opacity=".5"/>' for a in [i*math.pi/10 for i in range(20)])
    eyes = ''.join(f'<circle cx="{cx+dx}" cy="{cy+dy}" r="{r*.07}" fill="#2E1E10"/>' for dx, dy in ((-r*.15, -r*.3), (r*.15, -r*.3), (0, -r*.12)))
    return shadow(cx, cy+r, r) + f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#6B4A2B"/>' + hair + eyes
def coconut_half(cx, cy, r):
    return (shadow(cx, cy+r, r) + f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#6B4A2B"/><circle cx="{cx}" cy="{cy}" r="{r*.86}" fill="#FBF8F0"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r*.5}" fill="#E9E2D0"/>')

def egg(cx, cy, s, col):
    return (f'<ellipse cx="{cx}" cy="{cy}" rx="{34*s}" ry="{44*s}" fill="{col}"/>'
            f'<ellipse cx="{cx-10*s}" cy="{cy-16*s}" rx="{7*s}" ry="{13*s}" fill="#fff" opacity=".4" transform="rotate(20 {cx-10*s} {cy-16*s})"/>')
def basket(cx, cy, w, h):
    weave = ''.join(f'<path d="M{cx-w/2+6} {cy+h*k} H{cx+w/2-6}" stroke="#6E4A22" stroke-width="3" opacity=".55"/>' for k in (.25, .5, .75))
    return f'<path d="M{cx-w/2} {cy} H{cx+w/2} L{cx+w/2-24} {cy+h} H{cx-w/2+24} Z" fill="#A9763A"/>' + weave

def bottle(x, y, w, h, liquid, label_col='#FBF6E6', cap='#3C2A18', lab=''):
    return (shadow(x, y+h, w*.6) + f'<rect x="{x-w*.18}" y="{y-h*.28}" width="{w*.36}" height="{h*.3}" rx="6" fill="{liquid}" opacity=".9"/>'
            f'<rect x="{x-w*.22}" y="{y-h*.36}" width="{w*.44}" height="{h*.1}" rx="4" fill="{cap}"/>'
            f'<rect x="{x-w/2}" y="{y}" width="{w}" height="{h}" rx="{w*.18}" fill="{liquid}" opacity=".92"/>'
            f'<rect x="{x-w*.36}" y="{y+h*.28}" width="{w*.72}" height="{h*.42}" rx="6" fill="{label_col}"/>' + lab +
            f'<rect x="{x-w*.42}" y="{y+h*.06}" width="{w*.1}" height="{h*.8}" rx="4" fill="#fff" opacity=".28"/>')
def leaf(cx, cy, s, col='#4C8A3A', rot=0):
    return f'<path d="M0 0 Q{22*s} {-30*s} 0 {-60*s} Q{-22*s} {-30*s} 0 0Z" fill="{col}" transform="translate({cx} {cy}) rotate({rot})"/>'

def bowl(cx, cy, w, col='#B5683C'):
    return (shadow(cx, cy+w*.32, w*.62) + f'<path d="M{cx-w/2} {cy} H{cx+w/2} Q{cx+w/2-10} {cy+w*.38} {cx} {cy+w*.38} Q{cx-w/2+10} {cy+w*.38} {cx-w/2} {cy} Z" fill="{col}"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{w/2}" ry="{w*.07}" fill="{col}"/>')
def grains(cx, cy, w, h, colors, r, seed, shape='c', n=420):
    random.seed(seed); out = ''
    for _ in range(n):
        t = random.random()*math.pi; rr = math.sqrt(random.random())
        x = cx+math.cos(t)*w*rr*.95; y = cy-math.sin(t)*h*rr
        c = random.choice(colors)
        if shape == 'c':
            out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{c}"/>'
        else:
            out += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{r*2}" ry="{r*.8}" fill="{c}" transform="rotate({random.randint(0,180)} {x:.1f} {y:.1f})"/>'
    return out

def plume(x, y, ln, col, kind):
    out = f'<path d="M{x} {y+ln} Q{x+10} {y+ln*.5} {x} {y}" stroke="#7B9A3E" stroke-width="4" fill="none"/>'
    if kind == 'foxtail':
        for i in range(26):
            yy = y+i*4; out += f'<ellipse cx="{x+(i%2)*6-3}" cy="{yy}" rx="9" ry="3" fill="{col}" transform="rotate({(i%2)*50-25} {x} {yy})"/>'
    elif kind == 'pearl':
        out += f'<ellipse cx="{x}" cy="{y+22}" rx="14" ry="38" fill="{col}"/>' + ''.join(f'<circle cx="{x+random.randint(-9,9)}" cy="{y+random.randint(-10,52)}" r="4" fill="#8E8A7A" opacity=".7"/>' for _ in range(24))
    elif kind == 'ragi':
        for a in (-40, -20, 0, 20, 40):
            out += f'<path d="M{x} {y+6} Q{x+a*.9} {y-20} {x+a*1.3} {y-46}" stroke="{col}" stroke-width="7" stroke-linecap="round" fill="none"/>'
    else:
        for i in range(10):
            out += f'<circle cx="{x+i*3}" cy="{y+i*6}" r="4" fill="{col}"/><circle cx="{x-i*3}" cy="{y+i*6+4}" r="4" fill="{col}"/>'
    return out

def put(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)

P = os.path.join(IMG, 'products'); C = os.path.join(IMG, 'categories')
W, H = 600, 450
put(f'{P}/tomatoes.svg', svg(W, H, table()+tomato(210, 270, 90)+tomato(380, 290, 80, '#C9301F')+tomato(300, 200, 70, '#E2503A')+tomato(450, 215, 55, '#D6392B'), '#FCE9D8', '#F6C9A6'))
put(f'{P}/carrots.svg', svg(W, H, table('#B58C5A')+carrot(210, 120, 250, -14)+carrot(300, 110, 280, 4)+carrot(390, 125, 240, 18)+carrot(470, 150, 200, 30), '#E4F0D0', '#BFD8A0'))
put(f'{P}/coconut.svg', svg(W, H, table('#C9B28A')+leaf(100, 330, 3, '#5E9A45', -40)+leaf(520, 340, 3, '#5E9A45', 40)+coconut_whole(230, 270, 100)+coconut_half(410, 290, 90), '#E3F1EE', '#BFDCD6'))
eggs = ''.join(egg(x, y, s, c) for x, y, s, c in ((240, 280, 1.5, '#E9C79A'), (330, 270, 1.5, '#F3E3C9'), (420, 285, 1.5, '#D9A66B'), (285, 240, 1.4, '#F3E3C9'), (375, 235, 1.4, '#E9C79A')))
put(f'{P}/eggs.svg', svg(W, H, table('#C7A76B')+eggs+basket(330, 290, 300, 110), '#FFF4D6', '#F3D9A0'))
put(f'{P}/coconut-oil.svg', svg(W, H, table('#C9B28A')+coconut_half(440, 330, 60)+coconut_whole(160, 340, 50)+bottle(300, 120, 130, 240, '#F5EEC8', lab=leaf(300, 255, 1.1, '#4C8A3A')), '#E6F2E8', '#C3DEC9'))
nuts = ''.join(f'<g transform="translate({x} {y}) rotate({a})"><ellipse cx="-9" cy="0" rx="14" ry="10" fill="#D9A864"/><ellipse cx="9" cy="0" rx="14" ry="10" fill="#C99350"/></g>' for x, y, a in ((140, 360, -20), (190, 380, 15), (460, 365, 10), (505, 340, -30), (420, 390, 25)))
put(f'{P}/groundnut-oil.svg', svg(W, H, table('#B58C5A')+nuts+bottle(300, 120, 130, 240, '#D79A1E', lab=leaf(300, 255, 1.1, '#8A5A1E')), '#FBEBD0', '#EFCB90'))
jar = ('<path d="M230 150 H370 Q395 150 395 180 V330 Q395 375 350 375 H250 Q205 375 205 330 V180 Q205 150 230 150Z" fill="#E0A21B"/>'
       '<rect x="215" y="105" width="170" height="48" rx="10" fill="#6B4A2B"/><rect x="225" y="225" width="150" height="90" rx="10" fill="#FBF6E6"/>'
       '<path d="M300 245 l16 10 v22 l-16 10 l-16 -10 v-22Z" fill="#E0A21B"/><rect x="222" y="170" width="14" height="190" rx="6" fill="#fff" opacity=".28"/>')
dip = '<g transform="translate(470 330) rotate(25)"><rect x="-6" y="-120" width="12" height="110" rx="5" fill="#9A6A38"/><ellipse cx="0" cy="-2" rx="22" ry="26" fill="#C98A14"/>' + ''.join(f'<path d="M-22 {-8+i*8} H22" stroke="#9A6A38" stroke-width="3"/>' for i in range(3)) + '</g>'
put(f'{P}/honey.svg', svg(W, H, table('#C9A878')+shadow(300, 375, 110)+jar+dip, '#FFF1C9', '#F5D68A'))
def bowl_img(name, bg, colors, r, seed, shape, kind, kcol, bowlcol, w=240):
    body = table('#C9B28A') + plume(130, 150, 150, kcol, kind) + plume(480, 160, 140, kcol, kind) + bowl(300, 270, w, bowlcol) + grains(300, 270, w/2, 95, colors, r, seed, shape)
    put(f'{P}/{name}.svg', svg(W, H, body, bg[0], bg[1]))
random.seed(1)
bowl_img('ragi', ('#F2E3DC', '#DEBDAE'), ['#6E2F20', '#7C3A29', '#5A2418', '#8A4632'], 4, 11, 'c', 'ragi', '#7C3A29', '#B5683C')
bowl_img('rice', ('#EEF3F5', '#CFDDE4'), ['#FBF8EE', '#F1EBD6', '#FFFFFF', '#E8E0C6'], 3, 12, 'e', 'foxtail', '#E9D9A0', '#3E6B8A')
bowl_img('pearl-millet', ('#F0F0E6', '#D3D3BC'), ['#9C9A86', '#B4B196', '#85826E', '#C7C3A5'], 5, 13, 'c', 'pearl', '#B9B68F', '#8B6B4A')
bowl_img('foxtail-millet', ('#FFF5CC', '#F2DE8E'), ['#E7B923', '#F0C93F', '#D6A412', '#F6D96A'], 3, 14, 'c', 'foxtail', '#E3B32B', '#A9553C')
bowl_img('little-millet', ('#F6EBDD', '#E5CFAF'), ['#D8B887', '#C9A06A', '#E4C99E', '#B88D56'], 2.4, 15, 'c', 'little', '#C9A06A', '#5E7C4A')

S = lambda b, c1, c2: svg(600, 400, b, c1, c2)
put(f'{C}/vegetables.svg', S(table(600, 400, '#B58C5A')+tomato(180, 250, 80)+tomato(300, 275, 65, '#C9301F')+carrot(420, 100, 230, 16)+carrot(490, 120, 200, 28)+leaf(110, 170, 2.2, '#4C8A3A', -30), '#E4F0D0', '#BFD8A0'))
put(f'{C}/coconut.svg', S(table(600, 400, '#C9B28A')+leaf(90, 300, 3.2, '#5E9A45', -35)+leaf(130, 300, 3, '#4C8A3A', -5)+coconut_whole(300, 230, 95)+coconut_half(460, 265, 70), '#DDEFEA', '#B6D8CF'))
put(f'{C}/eggs.svg', S(table(600, 400, '#C7A76B')+''.join(egg(x, y, 1.4, c) for x, y, c in ((210, 240, '#E9C79A'), (300, 230, '#F3E3C9'), (390, 242, '#D9A66B')))+basket(300, 250, 330, 100), '#FFF4D6', '#F3D9A0'))
put(f'{C}/oils.svg', S(table(600, 400, '#B58C5A')+bottle(200, 110, 110, 200, '#F5EEC8', lab=leaf(200, 220, 1, '#4C8A3A'))+bottle(380, 125, 120, 215, '#D79A1E', lab=leaf(380, 238, 1, '#8A5A1E'))+bottle(500, 170, 80, 150, '#8E9A3A'), '#F4EBD0', '#E4D29E'))
hexes = ''.join(f'<path d="M{x} {y} l26 15 v30 l-26 15 l-26 -15 v-30Z" fill="{c}" stroke="#B87A0B" stroke-width="3"/>' for x, y, c in ((160, 90, '#F2B72A'), (212, 90, '#E8A81A'), (264, 90, '#F5C346'), (186, 135, '#E8A81A'), (238, 135, '#F2B72A'), (290, 135, '#E8A81A'), (160, 180, '#F5C346'), (212, 180, '#F2B72A'), (264, 180, '#E8A81A'), (316, 105, '#F5C346')))
put(f'{C}/honey.svg', S(hexes+'<path d="M140 230 Q300 270 440 230 V250 Q430 290 410 250 Q395 330 370 255 Q330 300 300 252 Q260 340 235 255 Q200 300 180 252 Q150 290 140 250Z" fill="#E0A21B"/>', '#FFF1C9', '#F5D68A'))
sack = '<path d="M210 150 Q300 120 390 150 L410 360 H190 Z" fill="#CFAE7A"/><path d="M215 150 Q300 175 385 150" stroke="#9A7A44" stroke-width="5" fill="none"/><rect x="235" y="230" width="130" height="70" rx="8" fill="#FBF6E6"/>'
wheat = ''.join(f'<path d="M{x} 340 L{x+dx} 80" stroke="#8A9A3E" stroke-width="4"/>' + ''.join(f'<ellipse cx="{x+dx}" cy="{90+i*16}" rx="7" ry="13" fill="#E3B32B" transform="rotate({(i%2)*60-30} {x+dx} {90+i*16})"/>' for i in range(5)) for x, dx in ((120, -10), (470, 20), (510, 40)))
put(f'{C}/grains.svg', S(table(600, 400, '#C9B28A')+wheat+sack+leaf(300, 270, 1, '#5E9A45'), '#F2EAD3', '#E1D2A6'))

rows = ''.join(f'<path d="M-100 {640+i*26} Q800 {560+i*30} 1700 {640+i*26}" stroke="#2F6A3A" stroke-width="3" opacity=".35" fill="none"/>' for i in range(6))
rays = ''.join(f'<path d="M800 430 L{800+math.cos(a)*1500} {430+math.sin(a)*1500}" stroke="#FFF3B0" stroke-width="18" opacity=".07"/>' for a in [i*math.pi/18+math.pi for i in range(19)])
hero = ('<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7C57A"/><stop offset=".55" stop-color="#FBE3A8"/><stop offset="1" stop-color="#FFF6D6"/></linearGradient>'
        '<radialGradient id="sun"><stop offset="0" stop-color="#FFFBE0"/><stop offset=".6" stop-color="#FFE08A"/><stop offset="1" stop-color="#FFE08A" stop-opacity="0"/></radialGradient></defs>'
        '<rect width="1600" height="800" fill="url(#sky)"/>' + rays +
        '<circle cx="800" cy="430" r="260" fill="url(#sun)"/><circle cx="800" cy="430" r="70" fill="#FFF3B8"/>'
        '<path d="M0 470 Q250 400 520 460 T1050 450 T1600 440 V800 H0Z" fill="#8FB07A"/>'
        '<path d="M0 520 Q300 460 640 520 T1250 505 T1600 520 V800 H0Z" fill="#5F8F55"/>'
        '<path d="M0 600 Q400 540 800 600 T1600 590 V800 H0Z" fill="#3E7A47"/>'
        '<path d="M0 680 Q500 620 1000 680 T1600 670 V800 H0Z" fill="#2F6A3A"/>' + rows)
put(f'{IMG}/hero-sunrise.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice">{hero}</svg>')

icon = ('<circle cx="32" cy="32" r="30" fill="#214D38"/><path d="M32 50 V28" stroke="#F7F5EB" stroke-width="3.5" stroke-linecap="round"/>'
        '<path d="M32 30 Q32 14 48 13 Q49 29 32 30Z" fill="#D9E5C8"/><path d="M32 38 Q32 24 17 23 Q16 37 32 38Z" fill="#9DB88A"/>'
        '<path d="M18 52 Q32 46 46 52" stroke="#C9A878" stroke-width="3" fill="none" stroke-linecap="round"/>')
put(f'{IMG}/logo.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 64" width="270" height="64">{icon}'
    '<text x="74" y="31" font-family="Georgia,\'Times New Roman\',serif" font-size="25" font-weight="700" fill="#214D38" letter-spacing="2">ARUNAI</text>'
    '<text x="75" y="52" font-family="Georgia,\'Times New Roman\',serif" font-size="14" fill="#78916E" letter-spacing="4.5">SACRED SOILS</text></svg>')
put(f'{BASE}/icons/leaf.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">{icon}</svg>')
print('done')
