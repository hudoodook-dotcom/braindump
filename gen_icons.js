const fs = require('fs');
const zlib = require('zlib');

/* ---------- PNG encoder ---------- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf){ let c = 0xffffffff; for (let i=0;i<buf.length;i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type,'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba){
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6;
  const raw = Buffer.alloc((w*4+1)*h); let p=0;
  for (let y=0;y<h;y++){ raw[p++]=0; for (let x=0;x<w;x++){ const i=(y*w+x)*4; raw[p++]=rgba[i];raw[p++]=rgba[i+1];raw[p++]=rgba[i+2];raw[p++]=rgba[i+3]; } }
  const idat = zlib.deflateSync(raw,{level:9});
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}

/* ---------- geometry helpers ---------- */
const inRoundRect = (x,y,x0,y0,x1,y1,r) => {
  if (x<x0||y<y0||x>x1||y>y1) return false;
  const rx = Math.min(x-x0, x1-x), ry = Math.min(y-y0, y1-y);
  if (rx>=r || ry>=r) return true;
  const dx=r-rx, dy=r-ry; return dx*dx+dy*dy <= r*r;
};
const inEllipse = (x,y,cx,cy,rx,ry) => { const a=(x-cx)/rx, b=(y-cy)/ry; return a*a+b*b<=1; };
const inCircle = (x,y,cx,cy,r) => { const dx=x-cx, dy=y-cy; return dx*dx+dy*dy<=r*r; };
function distSeg(px,py,ax,ay,bx,by){
  const vx=bx-ax, vy=by-ay, wx=px-ax, wy=py-ay;
  const c1=vx*wx+vy*wy; if (c1<=0) return Math.hypot(px-ax,py-ay);
  const c2=vx*vx+vy*vy; if (c2<=c1) return Math.hypot(px-bx,py-by);
  const t=c1/c2; return Math.hypot(px-(ax+t*vx), py-(ay+t*vy));
}
const onPolyline = (x,y,pts,w) => { for (let i=0;i<pts.length-1;i++){ if (distSeg(x,y,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1])<=w/2) return true; } return false; };
function arcPts(cx,cy,r,a0,a1,n){ const out=[]; for (let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n; out.push([cx+r*Math.cos(a), cy+r*Math.sin(a)]); } return out; }

/* ---------- icon ---------- */
function make(S, path){
  const rgba = new Uint8Array(S*S*4);
  const f = (v)=>v*S;
  const BG=[164,117,81], CREAM=[255,250,243], RULE=[221,202,176],
        PINK=[244,162,178], PINKD=[211,120,137], FACE=[92,60,71], FOLD=[240,226,207];
  const SS=2;

  // note
  const nx0=f(.205), ny0=f(.17), nx1=f(.795), ny1=f(.83), nr=f(.10);
  const earX=f(.66), earY0=ny0, earY1=f(.30); // 접힌 모서리
  // 룰드 라인
  const rules=[f(.66),f(.725),f(.79)].map(y=>({y, x0:f(.30), x1:f(.70)}));
  const rw=f(.016);
  // 뇌
  const bcx=f(.50), bcy=f(.47);
  const base={cx:bcx, cy:bcy, rx:f(.17), ry:f(.125)};
  const bumps=[ [f(.39),f(.40),f(.078)],[f(.50),f(.385),f(.085)],[f(.61),f(.40),f(.078)],
                [f(.335),f(.47),f(.066)],[f(.665),f(.47),f(.066)] ];
  const groove=[[bcx,f(.40)],[bcx,f(.455)]];
  const foldL=[[f(.41),f(.43)],[f(.44),f(.46)],[f(.41),f(.49)]];
  const foldR=[[f(.59),f(.43)],[f(.56),f(.46)],[f(.59),f(.49)]];
  const gw=f(.022), fw=f(.016);
  const eyeR=f(.018), eyeL=[f(.452),f(.49)], eyeRr=[f(.548),f(.49)];
  const smile=arcPts(f(.50),f(.495),f(.045),0.35,Math.PI-0.35,16), sw=f(.015);

  const inBrain=(x,y)=>{ if (inEllipse(x,y,base.cx,base.cy,base.rx,base.ry)) return true; for (const b of bumps) if (inCircle(x,y,b[0],b[1],b[2])) return true; return false; };

  for (let y=0;y<S;y++){
    for (let x=0;x<S;x++){
      let rs=0,gs=0,bs=0,as=0;
      for (let sy=0;sy<SS;sy++) for (let sx=0;sx<SS;sx++){
        const px=x+(sx+.5)/SS, py=y+(sy+.5)/SS;
        let col=null;
        if (inRoundRect(px,py,0,0,S,S,f(.22))) col=BG;
        // note (접힌 모서리는 비움)
        const cutEar = (px>earX && py<earY1 && (px-earX) > (py-earY0));
        if (inRoundRect(px,py,nx0,ny0,nx1,ny1,nr) && !cutEar) col=CREAM;
        // 접힌 삼각형
        if (px>earX-f(.005) && py<earY1+f(.005) && (px-earX) <= (py-earY0) && px<=nx1 && py>=ny0) col=FOLD;
        // 룰드 라인
        if (col===CREAM) for (const r of rules){ if (py>r.y-rw/2 && py<r.y+rw/2 && px>r.x0 && px<r.x1) col=RULE; }
        // 뇌
        if (inBrain(px,py)) col=PINK;
        if (onPolyline(px,py,groove,gw) || onPolyline(px,py,foldL,fw) || onPolyline(px,py,foldR,fw)) { if (inBrain(px,py)) col=PINKD; }
        // 얼굴
        if (inCircle(px,py,eyeL[0],eyeL[1],eyeR) || inCircle(px,py,eyeRr[0],eyeRr[1],eyeR)) col=FACE;
        if (onPolyline(px,py,smile,sw)) col=FACE;
        if (col){ rs+=col[0]; gs+=col[1]; bs+=col[2]; as+=255; }
      }
      const n=SS*SS, i=(y*S+x)*4;
      rgba[i]=Math.round(rs/n); rgba[i+1]=Math.round(gs/n); rgba[i+2]=Math.round(bs/n); rgba[i+3]=Math.round(as/n);
    }
  }
  fs.writeFileSync(path, encodePNG(S,S,rgba));
  console.log('saved', path);
}

make(192,'icon-192.png');
make(512,'icon-512.png');
