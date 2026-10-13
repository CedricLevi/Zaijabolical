"""Turns the acorn pictures into round stickers: centred on their circle, nothing clipped."""
from PIL import Image, ImageFilter
import numpy as np, sys
from scipy import ndimage
U = sys.argv[1] if len(sys.argv) > 1 else "./"   # folder with the original pictures
order = {1:'e1ada605',2:'6f93269f',3:'eeb54f7d',4:'68073575',5:'bf5cbc79',6:'4d72632a',7:'6851e2d4',8:'24b29888',9:'a8806bf3',10:'35b78d7c',11:'f40abd9b',12:'0e986664'}
PAD = 60
for m, f in order.items():
    a0 = np.asarray(Image.open(U + f + '-image.png').convert('RGBA'))
    white0 = a0[:, :, :3].astype(int).min(axis=2) > 236
    H, W = white0.shape
    pts = []
    for y in range(int(H * .2), int(H * .8)):
        xs = np.where(~white0[y])[0]
        if len(xs): pts += [(xs[0], y), (xs[-1], y)]
    P = np.array(pts, float)
    for _ in range(3):
        A = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]; b = (P ** 2).sum(1)
        cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]; r = np.sqrt(c + cx * cx + cy * cy)
        d = np.abs(np.hypot(P[:, 0] - cx, P[:, 1] - cy) - r); P = P[d < max(2, np.percentile(d, 80))]
    a = np.pad(a0, ((PAD, PAD), (PAD, PAD), (0, 0)), mode='edge')
    known = np.pad(np.ones((H, W), bool), PAD, constant_values=False)
    cx += PAD; cy += PAD
    yy, xx = np.mgrid[0:known.shape[0], 0:known.shape[1]]
    dist = np.hypot(xx - cx, yy - cy)
    inside = dist <= r - 2
    a = np.where((~known)[:, :, None], np.asarray(Image.fromarray(a).filter(ImageFilter.GaussianBlur(6))), a)
    pale = a[:, :, :3].astype(int).min(axis=2) > 200
    # parts of the drawing that poke out of the circle (hats, stems): only pieces attached to the circle
    out_parts = known & ~pale & (dist > r - 4)
    lab, n = ndimage.label(out_parts)
    ring = (dist > r - 4) & (dist < r - 1)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(n + 1))
    attached = {i for i in set(np.unique(lab[ring & out_parts])) - {0} if sizes[i] > 150}   # skip thin shadow slivers
    poke = np.isin(lab, list(attached)) & (dist > r - 2)
    keep = inside | poke
    alpha = Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
    img = Image.fromarray(a.astype('uint8')); img.putalpha(alpha)
    ys, xs = np.where(keep)
    half = int(np.ceil(max(cx - xs.min(), xs.max() - cx, cy - ys.min(), ys.max() - cy))) + 2
    box = tuple(int(round(v)) for v in (cx - half, cy - half, cx + half, cy + half))
    img.crop(box).resize((320, 320), Image.LANCZOS).save(f"assets/stickers/{m:02d}.webp", 'WEBP', quality=86, method=6)
    print(m, 'poking out:', int(poke.sum()), 'px')
