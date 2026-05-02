
import { technicals, levels } from "./indicators.js";
import { clamp, last, avg } from "./utils.js";

function marketState(x){
  if(x.entropy>80 || x.chaos>76) return "CHAOS";
  if(x.rsi>62 && x.dp<48 && x.flow>58 && x.entropy>58) return "DISTRIBUTION";
  if(x.compression>68 && x.vol<56 && Math.abs(x.dp-50)<16) return "COMPRESSION";
  if(x.dp<32 && x.momentum<42 && x.flow>45) return "BREAKDOWN";
  if(Math.abs(x.dp-50)>17 && x.momentum>55 && x.flow>50 && x.entropy<68) return "EXPANSION";
  if(x.entropy>72) return "NO_TRADE_ZONE";
  return "EXPANSION";
}
function decide(o, settings){
  if(o.entropy > settings.entropyMax || ["CHAOS","NO_TRADE_ZONE"].includes(o.state)) return "NO_TRADE";
  if(o.longQ>=72 && o.harmony>=64 && o.entropy<=64 && o.dp>55 && o.state!=="DISTRIBUTION") return "STRONG_LONG";
  if(o.shortQ>=72 && o.harmony>=64 && o.entropy<=64 && o.dp<45 && ["BREAKDOWN","DISTRIBUTION","EXPANSION"].includes(o.state)) return "STRONG_SHORT";
  if(o.longQ>=settings.minQuality && o.longQ>o.shortQ && o.dp>52 && o.entropy<=70 && o.state!=="DISTRIBUTION") return "LONG";
  if(o.shortQ>=settings.minQuality && o.shortQ>o.longQ && o.dp<48 && o.entropy<=70) return "SHORT";
  if(o.state==="COMPRESSION") return "WAIT";
  return "NO_TRADE";
}
function resonance(candles, minMatches=10){
  if(candles.length<90) return {bias:50,n:0,confidence:0,text:"Yetersiz veri"};
  const closes=candles.map(x=>+x.close), rets=[];
  for(let i=1;i<closes.length;i++) rets.push((closes[i]-closes[i-1])/(closes[i-1]||1));
  const n=20,target=rets.slice(-n), matches=[];
  const dist=(a,b)=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])*(x-b[i]),0));
  for(let i=0;i<rets.length-n-5;i++){
    const pat=rets.slice(i,i+n), d=dist(target,pat);
    matches.push({d, fwd:rets.slice(i+n,i+n+5).reduce((s,x)=>s+x,0)});
  }
  const top=matches.sort((a,b)=>a.d-b.d).slice(0,20).filter(x=>x.d<0.09);
  if(top.length<minMatches) return {bias:50,n:top.length,confidence:0,text:`k-NN örnek düşük (${top.length}/${minMatches})`};
  const m=avg(top.map(x=>x.fwd)), sd=Math.sqrt(avg(top.map(x=>(x.fwd-m)**2)))||1;
  const conf=clamp(Math.abs(m)/(sd/Math.sqrt(top.length)||1),0,1);
  return {bias:clamp(50+m*900*conf),n:top.length,confidence:conf,text:`k-NN ${top.length} örnek`};
}
export function analyze(symbol, candles, settings, btcContext=null, source="UNKNOWN"){
  if(!candles || candles.length<80){
    return { symbol, source, error:"Yetersiz veri", price:0, signal:"NO_TRADE", quality:0, candles:candles||[] };
  }
  const t=technicals(candles), lv=levels(candles), price=+candles.at(-1).close;
  const rsi=t.rsi.at(-1), atrPct=(t.atr||0)/(price||1);
  const rawSlope=(t.ema20.at(-1)-t.ema20.at(-5))/(t.ema20.at(-5)||1);
  const normSlope=rawSlope/(atrPct||.01);
  const eff=(price-candles.at(-20).close)/(Math.abs(price-candles.at(-20).close)+last(t.close,20).slice(1).reduce((s,x,i)=>s+Math.abs(x-last(t.close,20)[i]),0)||1);
  const dp=clamp(50+eff*30+normSlope*12+(price>t.vwap.at(-1)?5:-5)+(t.ema20.at(-1)>t.ema50.at(-1)?5:-5));
  const vol=clamp(atrPct*1800);
  const entropy=clamp(vol*.55 + Math.abs(50-rsi)*.25 + (t.volRatio>2?18:0));
  const momentum=clamp(50 + (rsi-50)*.7 + normSlope*12 + (t.macd.hist.at(-1)>0?7:-7));
  const flow=clamp(50+(t.volRatio-1)*18+(price>t.vwap.at(-1)?8:-8));
  const compression=clamp(100 - vol*1.2 - Math.abs(dp-50));
  const chaos=clamp(entropy*.72 + vol*.3);
  const state=marketState({entropy,chaos,rsi,dp,flow,momentum,compression,vol});
  const res=resonance(candles);
  let longQ=clamp(dp*.35 + momentum*.25 + flow*.15 + (100-entropy)*.15 + res.bias*.10);
  let shortQ=clamp((100-dp)*.35 + (100-momentum)*.20 + flow*.15 + (100-entropy)*.15 + (100-res.bias)*.15);
  let harmony=clamp(100-Math.abs(longQ-shortQ)*.55-Math.abs(entropy-45)*.22);
  let quality=Math.max(longQ,shortQ);
  const field={dp,entropy,harmony,momentum,flow,compression,chaos};
  if(symbol!=="BTCUSDT" && btcContext?.isChaotic){
    longQ=Math.max(0,longQ-18); shortQ=Math.max(0,shortQ-8); quality=Math.max(0,quality-15);
  }
  let signal=decide({longQ,shortQ,harmony,entropy,dp,flow,state}, settings);
  const side = signal.includes("SHORT") ? "SHORT" : signal.includes("LONG") ? "LONG" : "NONE";
  const plan=tradePlan(side, price, lv, t.atr, settings);
  return { symbol, source, candles, price, signal, side, quality, longQ, shortQ, state, field, technicals:t, levels:lv, plan, resonance:res, error:null };
}
export function tradePlan(side, price, lv, atr, settings){
  atr = atr || price*.015;
  if(side==="NONE") return {entry:price, stop:price, tp1:price, tp2:price, tp3:price, size:0, positionUsd:0, rr:0};
  const riskDist=atr*1.45;
  let stop,tp1,tp2,tp3;
  if(side==="LONG"){
    stop=price-riskDist; tp1=price+riskDist; tp2=price+riskDist*2; tp3=price+riskDist*3;
    const r=lv.nearestResistance; if(r && r.price>price){ const cap=r.price-Math.max(atr*.3,price*.001); if(cap>price) tp1=Math.min(tp1,cap); }
  } else {
    stop=price+riskDist; tp1=price-riskDist; tp2=price-riskDist*2; tp3=price-riskDist*3;
    const s=lv.nearestSupport; if(s && s.price<price){ const cap=s.price+Math.max(atr*.3,price*.001); if(cap<price) tp1=Math.max(tp1,cap); }
  }
  const riskUsd=(settings.accountSize||10000)*(settings.riskPct||1)/100;
  const size=Math.min(riskUsd/Math.abs(price-stop), ((settings.accountSize||10000)*(settings.maxPositionPct||50)/100)/price);
  return {entry:price,stop,tp1,tp2,tp3,size,positionUsd:size*price,rr:Math.abs(tp2-price)/Math.abs(price-stop)};
}
export function btcContext(rows){
  const b=rows.BTCUSDT;
  return { dp:b?.field?.dp||50, entropy:b?.field?.entropy||50, state:b?.state||"UNKNOWN", isChaotic: !!(b && (b.state==="CHAOS" || b.state==="BREAKDOWN" || b.field?.entropy>75)) };
}
export function runBacktest(candles, settings){
  let cash=settings.accountSize||10000,pos=null,trades=[],eq=[cash],opts={commission:.04,slippage:.03};
  const fee=(px,side,entry)=> side==="LONG" ? (entry?px*(1+opts.slippage/100+opts.commission/100):px*(1-opts.slippage/100-opts.commission/100)) : (entry?px*(1-opts.slippage/100-opts.commission/100):px*(1+opts.slippage/100+opts.commission/100));
  for(let i=90;i<candles.length;i++){
    const bar=candles[i];
    if(pos){
      if(pos.side==="LONG" && (bar.low<=pos.stop || bar.high>=pos.tp)){ const ex=bar.low<=pos.stop?pos.stop:pos.tp, exit=fee(ex,"LONG",false), pnl=(exit-pos.entry)*pos.size; cash+=pnl; trades.push({...pos,exit,pnl,status:bar.low<=pos.stop?"STOP":"TP"}); pos=null; }
      if(pos && pos.side==="SHORT" && (bar.high>=pos.stop || bar.low<=pos.tp)){ const ex=bar.high>=pos.stop?pos.stop:pos.tp, exit=fee(ex,"SHORT",false), pnl=(pos.entry-exit)*pos.size; cash+=pnl; trades.push({...pos,exit,pnl,status:bar.high>=pos.stop?"STOP":"TP"}); pos=null; }
    }
    if(!pos){
      const a=analyze("BT", candles.slice(0,i), settings, null, "BT");
      if(a.side==="LONG" || a.side==="SHORT"){
        const entry=fee(bar.open,a.side,true), risk=Math.abs(entry-a.plan.stop);
        if(risk>0 && a.quality>=settings.minQuality){
          const size=Math.min((settings.accountSize*(settings.riskPct/100))/risk, settings.accountSize*.5/entry);
          pos={side:a.side,entry,stop:a.plan.stop,tp:a.plan.tp2,size,signal:a.signal,time:bar.time,quality:a.quality};
        }
      }
    }
    eq.push(cash);
  }
  if(pos){ const ex=candles.at(-1).close, pnl=pos.side==="LONG"?(ex-pos.entry)*pos.size:(pos.entry-ex)*pos.size; cash+=pnl; trades.push({...pos,exit:ex,pnl,status:"KAPANIŞ"}); }
  const wins=trades.filter(t=>t.pnl>0), losses=trades.filter(t=>t.pnl<=0), pnl=trades.reduce((s,t)=>s+t.pnl,0), gw=wins.reduce((s,t)=>s+t.pnl,0), gl=Math.abs(losses.reduce((s,t)=>s+t.pnl,0));
  let peak=eq[0]||1, dd=0; for(const x of eq){ peak=Math.max(peak,x); dd=Math.max(dd,(peak-x)/(peak||1)); }
  return { trades, eq, pnl, ret:pnl/(settings.accountSize||10000)*100, win:trades.length?wins.length/trades.length:0, pf:gw/(gl||1), dd };
}
export function portfolioRisk(rows, settings){
  const list=Object.values(rows).filter(r=>r.plan&&r.side!=="NONE").map(r=>{
    const riskUsd=Math.abs(r.plan.entry-r.plan.stop)*(r.plan.size||0);
    return {symbol:r.symbol,signal:r.signal,quality:r.quality,positionUsd:r.plan.positionUsd,riskUsd,riskPct:riskUsd/(settings.accountSize||10000)*100};
  }).sort((a,b)=>b.riskPct-a.riskPct);
  return { rows:list, total:list.reduce((s,x)=>s+x.riskPct,0), limit:settings.maxTotalRiskPct||5 };
}
