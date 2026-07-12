# -*- coding: utf-8 -*-
# ひがしやまダッシュ! 16x32ドット絵オーサリング (クロノトリガー風プロポーション)
# 行文字列+パレット方式(シリーズ資産sprites.pyの発展形)
import json
from PIL import Image

PAL = {
  # 共通
  'K':'#20182a',  # アウトライン
  'S':'#f2c396','s':'#cf9a66',  # 肌/影
  'W':'#f2efe6','w':'#c9c4b4',  # 白/影
  # たいち
  'H':'#2a2432','h':'#443a52',  # 黒髪/ハイライト
  'G':'#43ab58','g':'#2c7d3d',  # パーカー/影
  'Y':'#ffd94d','B':'#8ad4f5',  # ゴーグル
  'P':'#3d5070','p':'#2b3a55',  # ズボン
  'M':'#9aa6b8','m':'#5f6b80',  # 銃
  'O':'#ff9a3d',                # マズル
  # チンピラ
  'R':'#e04338','r':'#a82c26',  # モヒカン
  'T':'#454358','t':'#2f2e40',  # シャツ
  'D':'#6e5138','d':'#4e3a28',  # ズボン茶
  'Q':'#111118',                # サングラス
  # バイク
  'C':'#c93a30','c':'#8f2620',  # 車体
  'A':'#3a3a44','a':'#23232c',  # タイヤ
  'E':'#2f62b0',                # ヘルメット
  'F':'#ffe08a',                # ライト
  # ボス
  'V':'#5a3272','v':'#41235ment4'.replace('ment4','4'),  # 特攻服/影
  'L':'#16161e','l':'#34343f',  # リーゼント
  'Z':'#ffd94d',
  # カラス
  'U':'#3a4150','u':'#262b38',
  'N':'#f0a020',
  # たいちの帽子(青) ※バイクの c/C と衝突しないよう専用キー
  '1':'#3d78c9','2':'#2a5aa0',
  # 汎用
  'X':'#ffffff',
}
PAL['v']='#412354'

def grid(rows, w):
    out=[]
    for r in rows:
        r = r.ljust(w,'.')
        assert len(r)==w, (len(r), r)
        out.append(r)
    return out

# ============ たいち 16x32 ============
# 体(顔含む) rows0-23 + 脚 rows24-31 を合成
TAICHI_BODY = grid([
'....22222.......',
'..2211111122....',
'.222222222222...',
'.KHHHHHHhHHK....',
'KHHhHHHHHHHHK...',
'KYYYYYYYYYYYK...',
'KYBBYYYBBYYYK...',
'KSSSSSSSSSSSK...',
'KS@@@@@@@@@SK...',  # 顔パッチ行1 (目)
'KS@@@@@@@@@SK...',  # 顔パッチ行2 (目)
'.KS@@@@@@@SK....',  # 顔パッチ行3 (口)
'.KSSSSSSSSSK....',
'..KKSSSSSKK.....',
'...KGGGGGK......',
'..KGGGGGGGK.....',
'.KGGgGGGGGGK....',
'.KGGgGGGGGGK....',
'.KGGgGGGGGGK....',
'.KGGgGGGGGGK....',
'.KKGgGGGGGGK....',
'..KGGGGGGGGK....',
'..KggggggggK....',
'..KGGGGGGGGK....',
'...KKKKKKKK.....',
], 16)

# 顔パッチ (rows 8,9,10 の @領域9文字ぶん)
TAICHI_FACE = {
 'run':  ['SKKSSSKKS','SKKSSSKKS','SSKKKSS'],       # まじめな目+への字ぎみ
 'jump': ['SKKSSSKKS','SSSSSSSSS','SKKKKKS'],       # にっこり口あき
 'dash': ['KSKSSSKSK','SKSSSSSKS','SKXXXKS'],       # >ω< 気合
 'hurt': ['KSKSSSKSK','KSKSSSKSK','SKKKKKS'],       # ><
}

# 脚フレーム rows24-31 (8行)
# 右向き(画面右)に走るストライド: 前脚=まえに伸ばして接地/後脚=うしろへ蹴り上げ(非接地)
TAICHI_LEGS = {
 'run0': grid([   # 右脚がまえ(接地)・左脚がうしろ(浮いている) = 右向きストライドA
 '...KPPK.KPPK....',
 '...KPPK.KPPK....',
 '..KPPK...KPPPK..',
 '..KPPK....KPPPK.',
 '.KPPK......KPPK.',
 '.KWWK......KPK..',
 'KWWWK.......KK..',
 'KKKK............',
 ],16),
 'run1': grid([   # 両脚が体の下で交差(パッシング・つぎのストライドへの中間姿勢)
 '......KPPPK.....',
 '......KPPPK.....',
 '.....KPPPPPK....',
 '.....KPPPPPK....',
 '....KPPPPPPPK...',
 '....KWWWWWWWK...',
 '...KWWWWWWWWWK..',
 '...KKKKKKKKKKK..',
 ],16),
 'run2': grid([   # 左脚がまえ(接地)・右脚がうしろ(浮いている) = 右向きストライドB
 '..KPPK...KPPK...',
 '.KPPK....KPPK...',
 'KPPPK...KPPK....',
 'KPPPK..KPPK.....',
 '.KPPK.KPPK......',
 '..KPK.KWWK......',
 '..KK.KWWWK......',
 '.........KKKK...',
 ],16),
 'jump': grid([   # 空中: 両脚をたたんで前傾
 '....KPPPK.......',
 '...KPPPPK.......',
 '..KPPPPPK.......',
 '..KPPPK.KPK.....',
 '.KPPK...KPPK....',
 '.KWWK...KWWK....',
 'KWWWK...KWWWK...',
 'KKKK....KKKK....',
 ],16),
}

# ============ チンピラ 16x32 ============
PUNK = {}
PUNK_BODY = grid([
'......KRK.......',
'.....KRRK.KK....',
'....KRrRKKRRK...',
'....KRrRRRrRK...',
'...KKRrRRRrRKK..',
'..KSSKRRRRRKSK..',
'..KSSSSSSSSSSK..',
'..KQQQQKQQQQK...',
'..KQQQQKQQQQK...',
'..KSSSSSSSSSK...',
'..KSSKKKKKSSK...',
'...KSSSSSSSK....',
'....KKSSSKK.....',
'....KTTTTTK.....',
'...KTTtTTTTK....',
'..KTTTtTTTTTK...',
'.KSKTTtTTTTKSK..',
'.KSKTTtTTTTKSSK.',
'..KKTTtTTTTKKK..',
'...KTTTTTTTK....',
'...KtttttttK....',
'...KTTTTTTTK....',
'....KKKKKKK.....',
'................',
], 16)
PUNK_LEGS = {
 'walk0': grid([
 '...KDDK.KDDK....',
 '...KDDK..KDDK...',
 '..KDDK....KDDK..',
 '..KDDK....KDDK..',
 '..KDDK.....KDDK.',
 '..KwwK.....KwwK.',
 '.KwwwK.....KwwwK',
 '.KKKK.......KKKK',
 ],16),
 'walk1': grid([
 '....KDDKKDDK....',
 '....KDDKDDK.....',
 '....KDDKDDK.....',
 '....KDDKDDK.....',
 '....KDDKDDK.....',
 '....KwwKwwK.....',
 '...KwwwKwwwK....',
 '...KKKK.KKKK....',
 ],16),
}

# ============ カラス 16x14 ============
BIRD = {
 'fly0': grid([
 '................',
 '......KUUUUK....',
 '....KUUUuuUUK...',
 '..KUUUUuuUUUK...',
 '.KUUUUUUUUUUUK..',
 'KNNKUXKUUUUUUK..',
 'KNNNKKUUUUUUUK..',
 '.KNKUUUUUUUUK...',
 '..KUUUUUUUUK....',
 '...KUUUUUUUUK...',
 '....KKKUUUUUK...',
 '.......KKKKK....',
 '................',
 '................',
 ],16),
 'fly1': grid([
 '................',
 '................',
 '................',
 '................',
 '.....KUUUUUK....',
 'KNNKUXKUUUUUK...',
 'KNNNKKUUUUUUUK..',
 '.KNKUUUUUUUUUUK.',
 '..KUUUUuuUUUUUK.',
 '...KUUUuuUUUUK..',
 '....KUUUUUUUK...',
 '.....KKKKKKK....',
 '................',
 '................',
 ],16),
}

# ============ バイクチンピラ 24x24 ============
BIKER = {
 'ride': grid([
 '..........KEEEEK........',
 '.........KEEEEEEK.......',
 '.........KEEeEEEK.......'.replace('e','E'),
 '.........KQQKQQK........',
 '.........KSSSSSK........',
 '..........KSSSK.........',
 '........KTTTTTK.........',
 '.......KTTTTTTTKSK......',
 '......KTTTTTTTTKSSK.....',
 '......KTTTTTTTTKKK......',
 '......KDDDDDDDK.........',
 '.....KCCCCCCCCCCK..K....',
 '....KCCCCcCCCCCCCKKF....',
 '...KCCCCCcCCCCCCCCKK....',
 '..KaAAKCCCCCCKaAAK......',
 '.KAAAAAK....KAAAAAK.....',
 '.KAaaAAK....KAaaAAK.....',
 '.KAAAAAK....KAAAAAK.....',
 '..KAAAK......KAAAK......',
 '...KKK........KKK.......',
 '........................',
 '........................',
 '........................',
 '........................',
 ],24),
}

# ============ ボス ドスゴロ 32x48 ============
BOSS_BODY = grid([
'..........KLLLLLK...............',
'........KLLLLLLLLLK.............',
'......KLLLLllLLLLLLK............',
'.....KLLLLllLLLLLLLLK...........',
'....KLLLLllLLLLLLLLLLK..........',
'....KLLLLlLLLLLLLLLKK...........',
'...KLLLLLLLLLLLLLKK.............',
'...KLLLKKKKKKKKKK...............',
'..KSSSSSSSSSSSSK................',
'..KSsSSSSSSSSSSSK...............',
'.KSSSSSSSSSSSSSSK...............',
'.KS@@@@@@@@@@@@SK...............',  # 顔1 まゆ
'.KS@@@@@@@@@@@@SK...............',  # 顔2 目
'.KS@@@@@@@@@@@@SK...............',  # 顔3 目下
'.KSS@@@@@@@@@@SSK...............',  # 顔4 口
'..KSS@@@@@@@@SSK................',  # 顔5 口
'...KSSSSSSSSSSK.................',
'....KKSSSSSSKK..................',
'.....KVVVVVVK...................',
'....KVVVVVVVVK..................',
'...KVVvVVVVVVVK.................',
'..KVVVvVVVVVVVVK................',
'.KVVVVvVVVVVVVVVK...............',
'KVVVVVvVVVVVVVVVVK..............',
'KVSKVVvVVVVVVVKSVK..............',
'KSSKVVvVVZZVVVKSSK..............',
'KSSKVVvVVZZVVVKSSSK.............',
'.KKKVVvVVVVVVVKKKK..............',
'...KVVvVVVVVVVK.................',
'...KVVvVVVVVVVK.................',
'...KvvvvvvvvvvK.................',
'...KVVVVVVVVVVK.................',
'...KVVVVVVVVVVK.................',
'....KKKKKKKKKK..................',
], 32)
BOSS_FACE = {  # rows11-15 の @領域 (12,12,12,10,8文字)
 'angry':['KKSSSSSSSSKK','SKKSSSSSSKKS','SSKKSSSSKKSS','SSKKKKKKSS','SSSSSSSS'],
 'rage': ['KKSSSSSSSSKK','KKKSSSSSSKKK','SKKSSSSSSKKS','SKKKKKKKKS','SKrrrrKS'],
 'dizzy':['SSSSSSSSSSSS','SKXKSSSSKXKS','SXKXSSSSXKXS','SSKKSSKKSS','SSKKKKSS'],
}
BOSS_LEGS = {
 'walk0': grid([
 '....KAAAK..KAAAK................',
 '....KAAAK...KAAAK...............',
 '...KAAAK.....KAAAK..............',
 '...KAAAK.....KAAAK..............',
 '..KAAAK.......KAAAK.............',
 '..KwwwwK......KwwwwK............',
 '.KwwwwwK......KwwwwwK...........',
 '.KKKKK.........KKKKK............',
 ],32),
 'walk1': grid([
 '.....KAAAKKAAAK.................',
 '.....KAAAKAAAK..................',
 '.....KAAAKAAAK..................',
 '.....KAAAKAAAK..................',
 '.....KAAAKAAAK..................',
 '.....KwwwKwwwK..................',
 '....KwwwwKwwwwK.................',
 '....KKKKK.KKKKK.................',
 ],32),
}

def compose(body, face_rows, face_marker='@', legs=None):
    out=[]
    fi=0
    for row in body:
        if face_marker in row:
            start = row.index(face_marker); end = row.rindex(face_marker)
            patch = face_rows[fi]; fi+=1
            assert len(patch)==end-start+1, (len(patch), end-start+1, patch)
            row = row[:start]+patch+row[end+1:]
        out.append(row)
    if legs: out += legs
    return out

# ================== 右向き走りサイクル: 腕振り + 前傾 ==================
# 体の胴体行(rows13-23)に、走りフレームごとの「前腕・後腕」を上書きする。
# 前腕=体の右(画面右/進行方向)へ突き出す / 後腕=体の左(画面左)へ引く
# → 参考画像のように腕が前後に振れて「右へ走っている」と読める。

def shift_rows(rows, cols, r0, r1):
    """指定行を右へcolsピクセルずらす(前傾表現)。"""
    out=[]
    for i,row in enumerate(rows):
        if r0<=i<=r1 and cols>0:
            row = '.'*cols + row[:-cols]
        out.append(row)
    return out

def stamp(rows, r, c, s):
    """rows[r]のc列目からsを上書き(sの'.'は透過)。"""
    row = list(rows[r])
    for i,ch in enumerate(s):
        if ch=='.' : continue
        if 0 <= c+i < len(row):
            row[c+i]=ch
    rows[r]=''.join(row)

def add_run_arms(body, frame, skin='S', sleeve=None):
    """
    frame: 'run0'(右腕まえ) / 'run1'(中間) / 'run2'(左腕まえ) / 'jump'
    体パーツを壊さないよう、腕は胴体の左右の空きカラムへ描く。
    """
    rows=[r for r in body]
    sl = sleeve or skin
    if frame=='run0':
        # 前腕: 大きく前(右)へ / 後腕: 後ろ(左)へ引く
        stamp(rows,15,11,'K'+sl+'K')
        stamp(rows,16,12,'K'+skin+skin+'K')
        stamp(rows,17,13,'K'+skin+'K')
        stamp(rows,16,0,'K'+sl+'K')
        stamp(rows,17,0,'K'+skin+'K')
        stamp(rows,18,1,'K'+skin+'K')
    elif frame=='run1':
        # 中間: 両腕とも体の横
        stamp(rows,16,11,'K'+sl+'K')
        stamp(rows,17,12,'K'+skin+'K')
        stamp(rows,18,12,'K'+skin+'K')
        stamp(rows,16,1,'K'+sl+'K')
        stamp(rows,17,1,'K'+skin+'K')
        stamp(rows,18,2,'K'+skin+'K')
    elif frame=='run2':
        # 左右反転の振り: 前腕を引き、後腕を前へ
        stamp(rows,16,11,'K'+sl+'K')
        stamp(rows,17,11,'K'+skin+'K')
        stamp(rows,18,12,'K'+skin+'K')
        stamp(rows,15,0,'K'+sl+'K')
        stamp(rows,16,0,'K'+skin+skin+'K')
        stamp(rows,17,1,'K'+skin+'K')
    else:  # jump: 両腕を上げ気味に
        stamp(rows,14,11,'K'+sl+'K')
        stamp(rows,15,12,'K'+skin+'K')
        stamp(rows,16,13,'K'+skin+'K')
        stamp(rows,14,1,'K'+sl+'K')
        stamp(rows,15,0,'K'+skin+'K')
        stamp(rows,16,0,'K'+skin+'K')
    # 前傾: 頭〜胸(rows0-12)を1px前(右)へずらす
    lean = 1 if frame in ('run0','run2') else 0
    if lean:
        rows = shift_rows(rows, lean, 0, 12)
    return rows

SPRITES = {}

def build_char(prefix, body, faces, legset, sleeve, skin='S'):
    """顔パッチ + 腕振り(フレーム連動) + 脚 を合成してSPRITESへ登録"""
    for expr,fp in faces.items():
        for legname,legs in legset.items():
            armed = add_run_arms(body, legname, skin=skin, sleeve=sleeve)
            SPRITES[f'{prefix}_{expr}_{legname}'] = compose(armed, fp, legs=legs)

build_char('taichi', TAICHI_BODY, TAICHI_FACE, TAICHI_LEGS, sleeve='G')
for legname,legs in PUNK_LEGS.items():
    SPRITES[f'punk_{legname}'] = PUNK_BODY[:-1] + legs  # 23行+8行=31 → 1行たす
    SPRITES[f'punk_{legname}'] = PUNK_BODY[:23] + legs + ['.'*16]
SPRITES['bird_fly0']=BIRD['fly0']; SPRITES['bird_fly1']=BIRD['fly1']
SPRITES['biker_ride']=BIKER['ride']
for expr,fp in BOSS_FACE.items():
    for legname,legs in BOSS_LEGS.items():
        SPRITES[f'boss_{expr}_{legname}'] = compose(BOSS_BODY, fp, legs=legs)

# ---- プレビューPNG ----
def render_all(scale=6):
    names = list(SPRITES.keys())
    cols = 6
    cw = 34*scale; chh = 46*scale
    rows = (len(names)+cols-1)//cols
    img = Image.new('RGB',(cols*cw, rows*chh),(40,32,56))
    px = img.load()
    def hx(c): return tuple(int(c[i:i+2],16) for i in (1,3,5))
    for idx,name in enumerate(names):
        gx,gy = (idx%cols)*cw+scale, (idx//cols)*chh+scale
        for y,row in enumerate(SPRITES[name]):
            for x,ch in enumerate(row):
                if ch=='.' : continue
                col = hx(PAL[ch])
                for dy in range(scale):
                    for dx in range(scale):
                        px[gx+x*scale+dx, gy+y*scale+dy] = col
    img.save('sprites_preview.png')
    print('preview saved', img.size, len(names),'sprites')

if __name__=='__main__':
    render_all()
    data = {'pal':PAL, 'sprites':SPRITES}
    json.dump(data, open('pix.json','w'), ensure_ascii=False)
    print('exported pix.json')

# ================== v3 追加: 家族4人 + ボス色違い ==================
PAL.update({
  'J':'#8a5432','j':'#a8703f',   # 茶髪
  'e':'#3a6ea8',                 # けんと短パン青
  'i':'#f27bb0','I':'#c9538c',   # のぞみピンク服
  'z':'#5a4aa0','x':'#42357a',   # ゆうしローブ紫
  'o':'#ffb867',                 # 杖のオーブ
})

GLASS_FACE = {   # メガネ組(えりか・ゆうし)用 顔パッチ 9,9,7
 'run':  ['KBBKSKBBK','KKKKKKKKK','SSKKKSS'],
 'jump': ['KBBKSKBBK','KKKKKKKKK','SKKKKKS'],
 'dash': ['KXXKSKXXK','KKKKKKKKK','SKXXXKS'],
 'hurt': ['KXXKSKXXK','KKKKKKKKK','SKKKKKS'],
}

def legs_recolor(legset, mapping):
    out={}
    for k,rows in legset.items():
        out[k]=[''.join(mapping.get(c,c) for c in r) for r in rows]
    return out

# ---- けんと 16x32 (小柄・茶髪ツンツン・赤スカーフ・黄シャツ・手裏剣) ----
KENTO_BODY = grid([
'................',
'....KJJJK..K....',
'..KKJjJJJKKJK...',
'.KJJJJJjJJJJK...',
'.KJjJJJJJJJK....',
'KJJJJjJJJJJJK...',
'KJJJJJJJjJJK....',
'KSSSSSSSSSSSK...',
'KS@@@@@@@@@SK...',
'KS@@@@@@@@@SK...',
'.KS@@@@@@@SK....',
'.KSSSSSSSSSK....',
'..KKSSSSSKK.....',
'..KRRRRRRRK.....',
'.KRRKYYYYKRRK...',
'.KRKYYYYYYYKK...',
'.KRKYyYYYYYK....'.replace('y','Y'),
'.KKYYYYYYYYK....',
'.KKYYYYYYYYK....',
'..KYYYYYYYYK....',
'..KYYYYYYYYK....',
'..KyyyyyyyyK....'.replace('y','g'),
'..KYYYYYYYYK....',
'...KKKKKKKK.....',
],16)
def add_hair_lock(rows, col0, r0, r1, ch='J', ch2='j'):
    # 画像の指定カラムにたれ髪を上書き(すでに何か描かれている場合はそのまま)
    out=[]
    for i,row in enumerate(rows):
        if r0<=i<=r1:
            chars=list(row)
            if chars[col0]=='.':
                chars[col0]=ch if (i-r0)%2==0 else ch2
            if col0+1<len(chars) and chars[col0+1]=='.':
                chars[col0+1]=ch
            row=''.join(chars)
        out.append(row)
    return out
KENTO_BODY = add_hair_lock(KENTO_BODY, 0, 2, 11, 'J', 'j')
KENTO_LEGS = legs_recolor(TAICHI_LEGS, {'P':'e'})
build_char('kento', KENTO_BODY, TAICHI_FACE, KENTO_LEGS, sleeve='Y')

# ---- のぞみ 16x32 (ポニーテール・リボン・ピンクのおどり服) ----
NOZOMI_BODY = grid([
'......KKKKK.....',
'..K..KHHHHHK....',
'.KHK KHhHHHHK...'.replace(' ','K'),
'KHHKKHHHHHhHK...',
'KHHHYHHHHHHHK...',
'.KHHYHHHHHHHHK..',
'..KHHHHHHHHHHK..',
'..KSSSSSSSSSSK..',
'..KS@@@@@@@@@SK.'[:16],
'..KS@@@@@@@@@SK.'[:16],
'...KS@@@@@@@SK..'[:16],
'..KSSSSSSSSSK...',
'...KKSSSSSKK....',
'....KiiiiiK.....',
'...KiiIiiiiK....',
'..KiiiIiiiiiK...',
'.KSKiiIiiiiKSK..',
'.KSKiiIiiiiKSSK.',
'..KKiiIiiiiKKK..',
'..KiiiiiiiiiK...',
'.KiiiiiiiiiiiK..',
'.KIIIIIIIIIIIK..',
'..KiiiiiiiiiK...',
'...KKKKKKKKK....',
],16)
NOZOMI_FACE = dict(TAICHI_FACE)
NOZOMI_LEGS = legs_recolor(TAICHI_LEGS, {'P':'S'})
build_char('nozomi', NOZOMI_BODY, NOZOMI_FACE, NOZOMI_LEGS, sleeve='i')

# ---- えりか 16x32 (茶髪ボブ・メガネ・赤い推しシャツ・剣) ----
ERIKA_BODY = grid([
'....KKKKKK......',
'..KKHHHHHHKK....',
'.KHHhHHHHHHHK...',
'.KHHHHHHhHHHK...',
'KHHhHHHHHHHHHK..',
'KHHHHHHHHHhHHK..',
'KHHSSSSSSSSSHK..',
'KHKS@@@@@@@@@SK.'[:16],
'KHKS@@@@@@@@@SK.'[:16],
'.KKS@@@@@@@SK...'[:16],
'.KHSSSSSSSSHK...',
'..KKSSSSSKK.....',
'...KCCCCCK......',
'..KCCCCCCCK.....',
'.KCCcCCCCCCK....',
'.KCCcCXXCCCK....',
'.KCCcCXXCCCK....',
'.KCCcCCCCCCK....',
'.KKCcCCCCCCK....',
'..KCCCCCCCCK....',
'..KHHHHHHHHK....',
'..KCCCCCCCCK....',
'...KKKKKKKK.....',
'................',
],16)
ERIKA_LEGS = legs_recolor(TAICHI_LEGS, {'P':'D'})
build_char('erika', ERIKA_BODY[:23], GLASS_FACE, ERIKA_LEGS, sleeve='C')

# ---- ゆうし 16x32 (黒髪・メガネ・むらさきローブ・杖) ----
YUSHI_BODY = grid([
'..KHHHHHHHHK....',
'.KHHHHHHHHHHK...',
'KHHHHHHHHHHHHK..',
'KHHHHHHHHHHHK...',
'KHHHHHHHHHHK....'[:16],
'.KHHHHHHHHHK....'[:16],
'.KSSSSSSSSSK....'[:16],
'.KS@@@@@@@@@SKDK'[:16],
'.KS@@@@@@@@@SKDK'[:16],
'..KS@@@@@@@SKKDK'[:16],
'..KSSSSSSSSSK...'[:16],
'...KKSSSSSKK....',
'....KzzzzzK.....',
'...KzzzzzzzK....',
'..KzzxzzzzzzK...',
'.KzzzxzzzzzzK...',
'.KKzzxzzzzzzK...',
'.KKzzxzzzzzzK...',
'.KKzzxzzzzzzK...',
'..KzzzzzzzzzK...',
'..KxxxxxxxxxK...',
'..KzzzzzzzzzK...',
'..KzzzzzzzzzK...',
'...KKKKKKKKK....',
],16)
YUSHI_LEGS = legs_recolor(TAICHI_LEGS, {'P':'x'})
build_char('yushi', YUSHI_BODY, TAICHI_FACE, YUSHI_LEGS, sleeve='z')

# ---- ボス色違い (グリッド文字置換で生成) ----
def remap_sprite(rows, mapping):
    return [''.join(mapping.get(c,c) for c in r) for r in rows]
BOSS_VARIANTS = {
  'boss2': {'V':'D','v':'d','L':'J','l':'j'},          # 茶コート・茶リーゼント (もり)
  'boss3': {'V':'A','v':'a','L':'M','l':'m'},          # 黒コート・銀リーゼント (こうじょう)
  'boss4': {'V':'Q','v':'t','L':'R','l':'r','S':'w','s':'w'},  # 黒コート・赤リーゼント・青白い肌 (まおう城)
}
for vname,mapping in BOSS_VARIANTS.items():
    for expr,fp in BOSS_FACE.items():
        for legname,legs in BOSS_LEGS.items():
            base = compose(BOSS_BODY, fp, legs=legs)
            SPRITES[f'{vname}_{expr}_{legname}'] = remap_sprite(base, mapping)

# 末尾で再レンダリング+再エクスポート (v3全量)
render_all(scale=5)
json.dump({'pal':PAL,'sprites':SPRITES}, open('pix.json','w'), ensure_ascii=False)
print('v3 export:', len(SPRITES), 'sprites')
