
import { last } from "./utils.js";

export function ema(a,n){
  if(!a.length) return [];
  const k=2/(n+1); let e=a[0]; const out=[];
  for(let i=0;i<a.length;i++){ e=i ? a[i]*k+e*(1-k) : a[i]; out.push(e); }
  return out;
}
export function sma(a,n){ return a.map((_,i)=>i<n-1?null:a.slice(i-n+1,i+1).reduce((s,x)=>s+x,0)/n); }
export function rsi(a,n=14){
  const out=Array(a.length).fill(50); let g=0,l=0;
  for(let i=1;i<a.length;i++){
    const d=a[i]-a[i-1];
    if(i<=n){ if(d>=0) g+=d; else l-=d; out[i]=50; }
    else { g=(g*(n-1)+Math.max(d,0))/n; l=(l*(n-1)+Math.max(-d,0))/n; const rs=g/(l||1e-9); out[i]=100-100/(1+rs); }
  }
  return out;
}
export function atr(h,l,c,n=14){
  const tr=[];
  for(let i=0;i<c.length;i++) tr.push(Math.max(h[i]-l[i], Math.abs(h[i]-(c[i-1]||c[i])), Math.abs(l[i]-(c[i-1]||c[i]))));
  return ema(tr,n);
}
export function macd(c){
  const e12=ema(c,12), e26=ema(c,26), line=c.map((_,i)=>(e12[i]||0)-(e26[i]||0)), signal=ema(line,9);
  return { line, signal, hist: line.map((x,i)=>x-(signal[i]||0)) };
}
export function boll(c,n=20,m=2){
  const mid=sma(c,n);
  const up=c.map((_,i)=>{ if(i<n-1) return null; const seg=c.slice(i-n+1,i+1), mean=mid[i], sd=Math.sqrt(seg.reduce((s,x)=>s+(x-mean)**2,0)/n); return mean+sd*m; });
  const lo=c.map((_,i)=>{ if(i<n-1) return null; const seg=c.slice(i-n+1,i+1), mean=mid[i], sd=Math.sqrt(seg.reduce((s,x)=>s+(x-mean)**2,0)/n); return mean-sd*m; });
  return { mid, up, lo };
}
export function vwap(candles){
  let pv=0,vv=0,lastDay=null,out=[];
  for(const x of candles){
    const d = x.time ? new Date(x.time).toISOString().slice(0,10) : "all";
    if(d !== lastDay){ pv=0; vv=0; lastDay=d; }
    const tp=(+x.high + +x.low + +x.close)/3, vol=+x.volume||0;
    pv += tp*vol; vv += vol;
    out.push(pv/(vv||1));
  }
  return out;
}
export function levels(candles){
  const c = last(candles,120), price=+candles.at(-1)?.close || 0;
  const highs=[], lows=[];
  for(let i=3;i<c.length-3;i++){
    const p=c[i];
    if(p.high>c[i-1].high&&p.high>c[i-2].high&&p.high>c[i+1].high&&p.high>c[i+2].high) highs.push({price:p.high,t:p.time});
    if(p.low<c[i-1].low&&p.low<c[i-2].low&&p.low<c[i+1].low&&p.low<c[i+2].low) lows.push({price:p.low,t:p.time});
  }
  const resistances=highs.filter(x=>x.price>price).sort((a,b)=>a.price-b.price).slice(0,6);
  const supports=lows.filter(x=>x.price<price).sort((a,b)=>b.price-a.price).slice(0,6);
  return { supports, resistances, nearestSupport:supports[0], nearestResistance:resistances[0] };
}
export function technicals(candles){
  const close=candles.map(x=>+x.close), high=candles.map(x=>+x.high), low=candles.map(x=>+x.low), volume=candles.map(x=>+x.volume||0);
  const atrA=atr(high,low,close), rsiA=rsi(close), mac=macd(close), b=boll(close), vw=vwap(candles);
  return { close, high, low, volume, ema20:ema(close,20), ema50:ema(close,50), ema200:ema(close,200), rsi:rsiA, atr:atrA.at(-1)||0, atrA, macd:mac, boll:b, vwap:vw, volRatio:(volume.at(-1)||0)/((last(volume,20).reduce((s,x)=>s+x,0)/Math.max(1,last(volume,20).length))||1) };
}
