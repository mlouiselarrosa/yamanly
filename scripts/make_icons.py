#!/usr/bin/env python3
"""Builds the icon and splash pictures in assets/ from assets/mark-keyed.png and wordmark-keyed.png."""
import os
from PIL import Image
import numpy as np
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));A=lambda f:os.path.join(R,'assets',f)
mk=Image.open(A('mark-keyed.png'));wm=Image.open(A('wordmark-keyed.png'))
top=np.array([46.2,81.8,39.0]);bot=np.array([22.9,49.8,22.9])
def grad(h,w):
    t=np.linspace(0,1,h)[:,None,None];return np.repeat(top*(1-t)+bot*t,w,axis=1)
def canvas(size,grad_bg,scale):
    c=Image.fromarray(grad(size,size).astype('uint8'),'RGB').convert('RGBA') if grad_bg else Image.new('RGBA',(size,size),(0,0,0,0))
    mw=int(size*scale);mh=int(mk.height*mw/mk.width)
    c.alpha_composite(mk.resize((mw,mh),Image.LANCZOS),((size-mw)//2,(size-mh)//2+int(size*0.01)));return c
canvas(1024,True,0.74).convert('RGB').save(A('icon-only.png'))
canvas(1024,False,0.56).save(A('icon-foreground.png'))
Image.fromarray(grad(1024,1024).astype('uint8')).save(A('icon-background.png'))
S=2732;mid=tuple(int(x) for x in (top+bot)/2);sp=Image.new('RGBA',(S,S),mid+(255,))
mw=int(S*0.34);mh=int(mk.height*mw/mk.width);sp.alpha_composite(mk.resize((mw,mh),Image.LANCZOS),((S-mw)//2,(S-mh)//2-120))
ww=int(S*0.30);wh=int(wm.height*ww/wm.width);sp.alpha_composite(wm.resize((ww,wh),Image.LANCZOS),((S-ww)//2,(S+mh)//2-60))
sp.convert('RGB').save(A('splash.png'));sp.convert('RGB').save(A('splash-dark.png'))
canvas(512,True,0.74).convert('RGB').save(os.path.join(R,'store','icon-512.png'))
print('icons ok')
