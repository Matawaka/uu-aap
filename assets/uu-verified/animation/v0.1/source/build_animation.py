#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Reproduce the delivered UU verified animation from its extracted artwork masks.

Portable successor of the build_animation.py used for the delivered GIFs. Motion,
compositing, palette and encoding are retained; inputs are exact alpha masks rather
than a container-specific source PNG. No font files, model calls or network access.
"""
from __future__ import annotations
import argparse
import base64
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import subprocess
import zlib

import cairo
import cv2
import numpy as np
from PIL import Image

SOURCE = Path(__file__).resolve().parent
BLUE, INK, WHITE = (0, 133, 255), (24, 26, 31), (255, 255, 255)
NORM = 1000.0
CENTER = (500.0, 500.0)
RADIUS, RING_WIDTH = 400.0, 40.0
INNER_RADIUS = RADIUS - RING_WIDTH / 2
WORD = 'verified'
BIRTH, SPACING, DROP_TIME = 4.40, 0.38, 0.20
SWAP_START, SWAP_END, FINAL_STILL, RESET_START, END_TIME = 9.90, 12.30, 13.10, 15.50, 16.50
EXPECTED = {
    'UU_verified.gif': 'b278999c4de856365acc65472087bc339b7d4c19675f2b057afaa0e6ef0af2f6',
    'UU_verified_once.gif': 'f3fb47e091eb4ebe96b890a0099a427f50e9f5210d24ece215597b169374b4ee',
}


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def ease(x):
    x = clamp(x)
    return x*x*x*(x*(x*6-15)+10)


def color(ctx, rgb, alpha=1.0):
    ctx.set_source_rgba(*(v/255 for v in rgb), alpha)


@dataclass
class Mask:
    surface: cairo.ImageSurface
    data: np.ndarray
    width: int
    height: int


def mask_surface(alpha):
    alpha = np.asarray(alpha, dtype=np.uint8)
    h, w = alpha.shape
    stride = cairo.ImageSurface.format_stride_for_width(cairo.FORMAT_A8, w)
    data = np.zeros((h, stride), dtype=np.uint8)
    data[:, :w] = alpha
    surface = cairo.ImageSurface.create_for_data(data, cairo.FORMAT_A8, w, h, stride)
    return Mask(surface, data, w, h)


def load_mask(record):
    h, w = record['shape']
    if not (0 < h <= 2048 and 0 < w <= 2048):
        raise ValueError('Invalid mask size')
    packed = base64.b64decode(record['zlibBase64'], validate=True)
    decoder = zlib.decompressobj()
    raw = decoder.decompress(packed, h*w+1)
    if len(raw) != h*w or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
        raise ValueError('Mask decompression size or framing mismatch')
    if hashlib.sha256(raw).hexdigest() != record['rawSha256']:
        raise ValueError('Mask digest mismatch')
    return np.frombuffer(raw, dtype=np.uint8).reshape(h, w)


class Artwork:
    def __init__(self, masks_path=SOURCE/'artwork-masks.json'):
        data = json.loads(masks_path.read_text(encoding='utf-8'))
        if data['schema'] != 'uu-verified-artwork-masks/v0.1':
            raise ValueError('Unsupported artwork schema')
        a = load_mask(data['eye'])
        self.eye = mask_surface(a)
        contours, _ = cv2.findContours((a > 127).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contour = max(contours, key=cv2.contourArea)[:, 0, :].astype(float)
        self.eye_points = (contour - [self.eye.width/2, self.eye.height/2])/1.254
        alpha = load_mask(data['letters'])
        bands = [(12, 114), (114, 207), (213, 276), (282, 315),
                 (320, 388), (391, 425), (432, 524), (527, 623)]
        self.glyphs = []
        self.word_scale = 0.799
        word_mid = (15+620)/2
        for char, (left, right) in zip(WORD, bands):
            m = mask_surface(alpha[8:139, left:right])
            x = ((left+right)/2-word_mid)*self.word_scale
            self.glyphs.append((char, m, x))
        self.births = [BIRTH+i*SPACING for i in range(len(WORD))]
        self.impacts = [b+DROP_TIME for b in self.births]


def capsule(ctx, cx, cy, w, h):
    r = min(w/2, h/2)
    x0, x1, y0, y1 = cx-w/2, cx+w/2, cy-h/2, cy+h/2
    ctx.new_sub_path()
    ctx.arc(x1-r, y0+r, r, -math.pi/2, 0)
    ctx.arc(x1-r, y1-r, r, 0, math.pi/2)
    ctx.arc(x0+r, y1-r, r, math.pi/2, math.pi)
    ctx.arc(x0+r, y0+r, r, math.pi, math.pi*1.5)
    ctx.close_path()


def glance(t):
    if t < .50: return 0.0
    if t < .94: return -ease((t-.50)/.44)
    if t < 1.22: return -1.0
    if t < 1.88: return -1+2*ease((t-1.22)/.66)
    if t < 2.20: return 1.0
    if t < 2.74: return 1-ease((t-2.20)/.54)
    if t < 3.04:
        a = t-2.74
        return .035*math.exp(-13*a)*math.sin(25*a)*(1-ease(a/.30))
    return 0.0


def pose(t):
    gaze = glance(t)
    out = {'eye_y': 460., 'spread': 0., 'eye_sx': 1.-.015*abs(gaze),
           'eye_sy': 1.-.016*abs(gaze), 'gaze': gaze, 'eye_shear': .045*gaze,
           'eye_tilt': .035*gaze, 'extra_tilt': 0., 'mouth_y': 674.,
           'mouth_w': 0., 'mouth_h': 0., 'mouth_scale': 1., 'mouth_alpha': 1.}
    if 3.15 <= t < 3.42:
        p = ease((t-3.15)/.27)
        d = 19*p+3*math.sin(math.pi*p)
        out.update(mouth_w=d, mouth_h=d)
    elif 3.42 <= t < 3.87:
        p = ease((t-3.42)/.45)
        out.update(mouth_w=19+(545-19)*p, mouth_h=19-5*p)
    elif 3.87 <= t < 4.26:
        p = ease((t-3.87)/.39)
        out.update(mouth_w=545+(588-545)*p, mouth_h=14+(158-14)*p)
    elif t >= 4.26:
        out.update(mouth_w=588., mouth_h=158.)
    if SWAP_START <= t < SWAP_END:
        p = (t-SWAP_START)/(SWAP_END-SWAP_START)
        spread = ease(p/.22) if p < .22 else (1. if p <= .72 else 1-ease((p-.72)/.28))
        out.update(eye_y=460+138*ease(p), spread=72*spread,
                   eye_sx=1-.14*spread, eye_sy=1+.065*spread,
                   extra_tilt=.020*math.sin(2*math.pi*p)*spread)
        if p < .22:
            q = ease(p/.22)
            out.update(mouth_y=674-44*q, mouth_scale=1-.64*q)
        elif p < .72:
            q = ease((p-.22)/.50)
            out.update(mouth_y=630-277*q, mouth_scale=.36)
        else:
            q = ease((p-.72)/.28)
            out.update(mouth_y=353., mouth_scale=.36+.64*q)
    elif SWAP_END <= t < FINAL_STILL:
        a = t-SWAP_END
        env = math.exp(-6.5*a)*(1-ease(a/(FINAL_STILL-SWAP_END)))
        wave = env*math.sin(18*a)
        out.update(eye_y=598+4.0*wave, eye_sx=1-.015*wave,
                   eye_sy=1+.035*wave, extra_tilt=.025*wave,
                   mouth_y=353-2.3*wave)
    elif FINAL_STILL <= t < RESET_START:
        out.update(eye_y=598., mouth_y=353.)
    elif t >= RESET_START:
        a = t-RESET_START
        out.update(eye_y=598-138*ease((a-.25)/.75), mouth_y=353.)
        p = ease(a/.52)
        out['mouth_scale'] = 1-.72*p
        out['mouth_alpha'] = 1-p
    return out


def glyph_pose(t, i, art):
    age = t-art.births[i]
    if age < 0: return None
    alpha = ease(age/.07)
    rotation = dy = dx = 0.
    sx = sy = 1.
    direction = -1 if i % 2 == 0 else 1
    if age < DROP_TIME:
        q = age/DROP_TIME
        dy = -25*(1-q*q)
        rotation = direction*math.radians(6)*(1-ease(q))
        sx, sy = .98+.02*ease(q), 1.025-.025*ease(q)
    else:
        a = age-DROP_TIME
        dy = -10*math.exp(-8.5*a)*math.sin(22*a)
        sy = 1-.16*math.exp(-13*a)*math.sin(27*a)
        sx = 1+.065*math.exp(-13*a)*math.sin(27*a)
        rotation = direction*math.radians(7)*math.exp(-9*a)*math.sin(23*a)
    for j, impact in enumerate(art.impacts):
        if j <= i: continue
        distance = j-i
        a = t-impact-.026*distance
        if 0 <= a < .9:
            strength = math.exp(-.77*(distance-1))
            env = math.exp(-9*a)*(1-ease(a/.9))
            sign = -1 if (j-i) % 2 == 0 else 1
            rotation += sign*math.radians(8)*strength*env*math.sin(25*a)
            dy += 2.6*strength*env*math.sin(24*a)
            dx -= 1.9*strength*env*math.sin(21*a)
    if t >= 7.88:
        return dict(dx=0., dy=0., sx=1., sy=1., rotation=0., alpha=1.)
    return dict(dx=dx, dy=dy, sx=sx, sy=sy, rotation=rotation, alpha=alpha)


class Renderer:
    def __init__(self, art, size=768, ss=2):
        self.art, self.size, self.ss = art, size, ss
        self.surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, size*ss, size*ss)
        self.ctx = cairo.Context(self.surface)
        self.ctx.set_antialias(cairo.ANTIALIAS_BEST)
        self.worst_radius = 0.

    def draw_eye(self, t, which, p):
        ctx, eye = self.ctx, self.art.eye
        sign = -1 if which == 0 else 1
        x = 500+sign*(158+p['spread'])+30*p['gaze']
        y, sx, sy = p['eye_y'], p['eye_sx'], p['eye_sy']
        angle, shear = p['eye_tilt']+sign*p['extra_tilt'], p['eye_shear']
        pts = self.art.eye_points.copy()
        pts[:, 0] *= sx
        pts[:, 1] *= sy
        pts[:, 0] += shear*pts[:, 1]
        c, s = math.cos(angle), math.sin(angle)
        pts = pts@np.array([[c, s], [-s, c]])+[x-500, y-500]
        r = float(np.sqrt((pts*pts).sum(1)).max())
        self.worst_radius = max(self.worst_radius, r)
        if r > INNER_RADIUS-1.5:
            raise AssertionError(f'Eye outside safe circle at {t:.3f}s: {r}')
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        ctx.transform(cairo.Matrix(1, 0, shear, 1, 0, 0))
        ctx.scale(sx/1.254, sy/1.254)
        color(ctx, INK)
        ctx.mask_surface(eye.surface, -eye.width/2, -eye.height/2)
        ctx.restore()

    def draw_mouth(self, t, p):
        if p['mouth_w'] < .01 or p['mouth_alpha'] < .0001: return
        ctx = self.ctx
        w, h, scale = p['mouth_w'], p['mouth_h'], p['mouth_scale']
        half_segment = max(0., (w-h)/2)*scale
        rad = math.hypot(half_segment, p['mouth_y']-500)+h/2*scale
        self.worst_radius = max(self.worst_radius, rad)
        if rad > INNER_RADIUS-1.5:
            raise AssertionError(f'Mouth outside safe circle at {t}: {rad}')
        ctx.save()
        ctx.translate(500, p['mouth_y'])
        ctx.scale(scale, scale)
        if p['mouth_alpha'] < 1: ctx.push_group()
        capsule(ctx, 0, 0, w, h)
        color(ctx, BLUE)
        ctx.fill()
        ctx.save()
        capsule(ctx, 0, 0, max(1, w-10), max(1, h-10))
        ctx.clip()
        if t >= BIRTH:
            for i, (_, m, x) in enumerate(self.art.glyphs):
                g = glyph_pose(t, i, self.art)
                if g is None: continue
                ctx.save()
                ctx.translate(x+g['dx'], g['dy']+36)
                ctx.rotate(g['rotation'])
                ctx.scale(g['sx'], g['sy'])
                ctx.translate(0, -36)
                ctx.scale(self.art.word_scale, self.art.word_scale)
                color(ctx, WHITE, g['alpha'])
                ctx.mask_surface(m.surface, -m.width/2, -m.height/2)
                ctx.restore()
        ctx.restore()
        if p['mouth_alpha'] < 1:
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(p['mouth_alpha'])
        ctx.restore()

    def render(self, t):
        ctx = self.ctx
        ctx.save()
        ctx.identity_matrix()
        color(ctx, WHITE)
        ctx.paint()
        ctx.scale(self.size*self.ss/NORM, self.size*self.ss/NORM)
        color(ctx, BLUE)
        ctx.set_line_width(RING_WIDTH)
        ctx.arc(*CENTER, RADIUS, 0, 2*math.pi)
        ctx.stroke()
        ctx.save()
        ctx.arc(*CENTER, INNER_RADIUS-1, 0, 2*math.pi)
        ctx.clip()
        p = pose(t)
        for i in range(2): self.draw_eye(t, i, p)
        self.draw_mouth(t, p)
        ctx.restore()
        ctx.restore()
        self.surface.flush()
        n = self.size*self.ss
        raw = np.ndarray((n, n, 4), dtype=np.uint8, buffer=self.surface.get_data(),
                         strides=(self.surface.get_stride(), 4, 1))
        rgb = Image.fromarray(raw[:, :, :3][:, :, ::-1].copy(), 'RGB')
        if self.ss != 1:
            rgb = rgb.resize((self.size, self.size), Image.Resampling.LANCZOS)
        return rgb


def palette():
    colors = [WHITE, BLUE, INK]
    for a, b, n in [(BLUE, WHITE, 100), (INK, WHITE, 100), (INK, BLUE, 50)]:
        for s in np.linspace(0, 1, n+2)[1:-1]:
            rgb = tuple(int(round(x*(1-s)+y*s)) for x, y in zip(a, b))
            if rgb not in colors: colors.append(rgb)
    colors = colors[:256]
    colors += [WHITE]*(256-len(colors))
    pal = Image.new('P', (1, 1))
    pal.putpalette([v for c in colors for v in c])
    return pal


def static_key(t):
    if t < .5: return 'initial'
    if 3.04 <= t < 3.15: return 'eyes_fixed'
    if 4.26 <= t < BIRTH: return 'empty_mouth'
    if 7.88 <= t < SWAP_START: return 'completed_bottom'
    if FINAL_STILL <= t < RESET_START: return 'final'
    return None


def build(outdir, size=768, fps=50, video=False, export_frames=False, exact=False):
    outdir.mkdir(parents=True, exist_ok=True)
    art = Artwork()
    r = Renderer(art, size=size, ss=2)
    pal = palette()
    proc = None
    if video:
        proc = subprocess.Popen(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
            '-f', 'rawvideo', '-vcodec', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{size}x{size}',
            '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(outdir/'UU_verified.mp4')],
            stdin=subprocess.PIPE)
    if export_frames: (outdir/'frames').mkdir(exist_ok=True)
    frames, durations = [], []
    prev = previous_key = last_rgb = None
    dt = int(round(1000/fps))
    try:
        for i in range(round(END_TIME*fps)):
            t = i/fps
            key = static_key(t)
            im = last_rgb if key is not None and key == previous_key else r.render(t)
            previous_key, last_rgb = key, im
            if proc:
                assert proc.stdin is not None
                proc.stdin.write(im.tobytes())
            if export_frames:
                im.save(outdir/'frames'/f'{i:04d}.png')
            if key is not None and key == prev:
                durations[-1] += dt
            else:
                frames.append(im.quantize(palette=pal, dither=Image.Dither.NONE))
                durations.append(dt)
            prev = key
            if i % 100 == 0: print(f'Render {i}/{round(END_TIME*fps)}', flush=True)
    finally:
        if proc and proc.stdin: proc.stdin.close()
    if proc and proc.wait() != 0: raise RuntimeError('Video encoder failed')
    frames[0].save(outdir/'UU_verified.gif', save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, disposal=1, optimize=False, background=0)
    counts = np.cumsum([0]+durations)
    cut = next(k for k, v in enumerate(counts) if v >= int(RESET_START*1000))
    frames[0].save(outdir/'UU_verified_once.gif', save_all=True, append_images=frames[1:cut],
                   duration=durations[:cut], disposal=1, optimize=False, background=0)
    r.render(13.5).save(outdir/'UU_verified_final.png')
    findings = {}
    for name, expected in EXPECTED.items():
        p = outdir/name
        digest = hashlib.sha256(p.read_bytes()).hexdigest()
        with Image.open(p) as g:
            loop = g.info.get('loop')
            ms = 0
            for i in range(g.n_frames):
                g.seek(i)
                g.load()
                ms += g.info.get('duration', 0)
            findings[name] = dict(sha256=digest, bytes=p.stat().st_size, frames=g.n_frames,
                duration_ms=ms, size=list(g.size), loop=loop, matches_delivered_bytes=digest == expected)
            assert ms == (16500 if name == 'UU_verified.gif' else 15500)
            assert g.size == (size, size)
        if exact and digest != expected:
            raise AssertionError(f'{name}: does not match delivered bytes: {digest}')
    if video:
        p = outdir/'UU_verified.mp4'
        findings[p.name] = dict(bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
    report = dict(status='ARTWORK_BUILD_ONLY_NOT_UU_VERIFIED_ISSUANCE',
                  sampling_fps=fps, max_content_radius=r.worst_radius, inner_ring_radius=INNER_RADIUS,
                  glyphs_clipped_to_capsule=True, original_reference_sha256=
                  '90ed6871efde5f5348c4985a5d7ef3c77c219664cd3eeba8548e5cc10255d8aa',
                  cairo_version=cairo.cairo_version_string(), files=findings)
    (outdir/'build-report.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=SOURCE.parent/'rendered')
    parser.add_argument('--size', type=int, default=768)
    parser.add_argument('--fps', type=int, choices=[25, 50], default=50)
    parser.add_argument('--video', action='store_true', help='Also render MP4 using local FFmpeg')
    parser.add_argument('--frames', action='store_true', help='Export all uniformly sampled PNG frames')
    parser.add_argument('--require-exact', action='store_true', help='Fail unless both GIFs match delivered bytes')
    args = parser.parse_args()
    if not (64 <= args.size <= 2048 and args.size % 2 == 0):
        parser.error('--size must be even and between 64 and 2048')
    if args.require_exact and (args.size != 768 or args.fps != 50):
        parser.error('Exact comparison requires --size 768 --fps 50')
    build(args.output, args.size, args.fps, args.video, args.frames, args.require_exact)
