
import { fmt } from "./utils.js";

export function drawCandles(canvas, analysis){
  if(!canvas || !analysis?.candles?.length) return;
  const ctx=canvas.getContext("2d"), d=Math.min(devicePixelRatio||1,2), r=canvas.getBoundingClientRect();
  canvas.width=Math.max(1,Math.floor(r.width*d)); canvas.height=Math.max(1,Math.floor(r.height*d)); ctx.setTransform(d,0,0,d,0,0);
  const w=r.width,h=r.height,padL=46,padR=58,padT=24,padB=35;
  ctx.clearRect(0,0,w,h);
  const bg=ctx.createLinearGradient(0,0,0,h); bg.addColorStop(0,"#07111d"); bg.addColorStop(1,"#02050a"); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
  const c=analysis.candles.slice(-130), extras=[analysis.plan?.stop,analysis.plan?.tp1,analysis.plan?.tp2,analysis.levels?.nearestSupport?.price,analysis.levels?.nearestResistance?.price].filter(Number.isFinite);
  let hi=Math.max(...c.map(x=>+x.high),...extras), lo=Math.min(...c.map(x=>+x.low),...extras), range=hi-lo||1; hi+=range*.05; lo-=range*.05;
  const x=i=>padL+i*(w-padL-padR)/Math.max(1,c.length-1), y=v=>h-padB-(v-lo)/(hi-lo||1)*(h-padT-padB);
  ctx.strokeStyle="#1d2b42"; ctx.lineWidth=1; ctx.font="10px ui-monospace,Consolas,monospace";
  for(let i=0;i<6;i++){ const yy=padT+i*(h-padT-padB)/5, val=hi-(hi-lo)*i/5; ctx.beginPath(); ctx.moveTo(padL,yy); ctx.lineTo(w-padR,yy); ctx.stroke(); ctx.fillStyle="#7890ad"; ctx.textAlign="right"; ctx.fillText("$"+fmt(val),w-8,yy+3); }
  const vols=c.map(p=>+p.volume||0), vmax=Math.max(...vols,1), volH=42, cw=Math.max(3,Math.min(9,(w-padL-padR)/c.length*.62));
  c.forEach((p,i)=>{ const xx=x(i), up=+p.close>=+p.open, col=up?"#16f08b":"#ff4d67"; ctx.strokeStyle=col; ctx.beginPath(); ctx.moveTo(xx,y(p.low)); ctx.lineTo(xx,y(p.high)); ctx.stroke(); const top=y(Math.max(p.open,p.close)), bot=y(Math.min(p.open,p.close)); ctx.fillStyle=col; ctx.fillRect(xx-cw/2,top,cw,Math.max(2,bot-top)); ctx.fillStyle=up?"rgba(22,240,139,.16)":"rgba(255,77,103,.16)"; ctx.fillRect(xx-cw/2,h-padB-vols[i]/vmax*volH,cw,vols[i]/vmax*volH); });
  const hline=(v,col,label)=>{ if(!Number.isFinite(v))return; const yy=y(v); ctx.setLineDash([6,6]); ctx.strokeStyle=col; ctx.beginPath(); ctx.moveTo(padL,yy); ctx.lineTo(w-padR,yy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle=col; ctx.textAlign="left"; ctx.fillText(label,padL+5,yy-4); };
  hline(analysis.plan?.stop,"#ff4d67","SL"); hline(analysis.plan?.tp1,"#16f08b","TP1"); hline(analysis.levels?.nearestSupport?.price,"#16f08b","S"); hline(analysis.levels?.nearestResistance?.price,"#ff4d67","R");
  const last=+c.at(-1).close, yy=y(last); ctx.setLineDash([5,5]); ctx.strokeStyle="#22d3ee"; ctx.beginPath(); ctx.moveTo(padL,yy); ctx.lineTo(w-padR,yy); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle="#eaf1fb"; ctx.textAlign="center"; ctx.fillText(fmt(last),w-padR+30,yy+4);
}
export function drawLine(canvas, values, color="#22d3ee"){
  if(!canvas || !values?.length) return;
  const ctx=canvas.getContext("2d"), d=Math.min(devicePixelRatio||1,2), r=canvas.getBoundingClientRect();
  canvas.width=Math.floor(r.width*d); canvas.height=Math.floor(r.height*d); ctx.setTransform(d,0,0,d,0,0);
  const w=r.width,h=r.height,p=30; ctx.clearRect(0,0,w,h); ctx.fillStyle="#050a12"; ctx.fillRect(0,0,w,h);
  const a=values.filter(v=>Number.isFinite(+v)).map(Number); if(a.length<2)return;
  let min=Math.min(...a), max=Math.max(...a); if(min===max){min-=1;max+=1}
  const x=i=>p+i*(w-2*p)/Math.max(1,a.length-1), y=v=>h-p-(v-min)/(max-min)*(h-2*p);
  ctx.strokeStyle="#1d2b42"; for(let i=0;i<5;i++){const yy=p+i*(h-2*p)/4;ctx.beginPath();ctx.moveTo(p,yy);ctx.lineTo(w-p,yy);ctx.stroke();}
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath(); a.forEach((v,i)=>{ if(i)ctx.lineTo(x(i),y(v)); else ctx.moveTo(x(i),y(v)); }); ctx.stroke();
}
