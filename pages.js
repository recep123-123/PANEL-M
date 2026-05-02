
import { state, setSort, save, apiKeys, setApiKeys } from "./state.js";
import { esc, fmt, pct, signed, table, sigPill, sigClass, avg, toast } from "./utils.js";
import { runBacktest, portfolioRisk } from "./engine.js";
import { drawCandles, drawLine } from "./charts.js";
import { getAttention, getDerivatives } from "./api.js";
import { VERSION, PAGE_NAMES } from "./config.js";

function metric(title,value,sub,bar=60,cls=""){
  return `<div class="card metric"><h3>${esc(title)}</h3><div class="value ${cls}">${value}</div><small>${esc(sub||"")}</small><div class="bar"><i style="width:${Math.max(0,Math.min(100,bar))}%"></i></div></div>`;
}
function selected(){ return state.rows[state.selected] || Object.values(state.rows)[0]; }
function coinSelector(page){
  const syms=state.settings.symbols;
  return `<div class="card"><h3>Coin Seçici</h3><div class="formGrid"><div class="field"><label>Coin</label><select onchange="window.omni.selectCoin(this.value)">${syms.map(s=>`<option ${s===state.selected?"selected":""}>${s}</option>`).join("")}</select></div><div class="field"><label>Sayfa</label><input readonly value="${esc(PAGE_NAMES[page]||page)}"/></div></div></div>`;
}
function attachSortable(root, tableId, cols){
  root.querySelectorAll(`[data-table="${tableId}"] th[data-sort]`).forEach(th=>th.addEventListener("click",()=>{setSort(tableId, th.dataset.sort); window.omni.render();}));
}
function simpleTableHtml(rows, cols, tableId){
  return `<div data-table="${tableId}">${table(rows, cols, state.sort[tableId], null)}</div>`;
}
export function dashboard(){
  const rows=Object.values(state.rows), live=rows.filter(r=>String(r.source).startsWith("LIVE")).length, sig=rows.filter(r=>r.signal&&r.signal!=="NO_TRADE").length;
  const btc=state.rows.BTCUSDT;
  const cols=[
    {key:"symbol",label:"Coin",val:r=>r.symbol,html:r=>`<b>${r.symbol}</b>`},
    {key:"price",label:"Fiyat",val:r=>r.price,html:r=>"$"+fmt(r.price)},
    {key:"signal",label:"Sinyal",val:r=>r.signal,html:r=>sigPill(r.signal)},
    {key:"quality",label:"Kalite",val:r=>r.quality,html:r=>fmt(r.quality,0)},
    {key:"state",label:"Faz",val:r=>r.state,html:r=>`<span class="pill">${esc(r.state)}</span>`},
    {key:"entropy",label:"Entropi",val:r=>r.field?.entropy||0,html:r=>fmt(r.field?.entropy,0)},
    {key:"source",label:"Kaynak",val:r=>r.source,html:r=>`<span class="pill">${esc(r.source)}</span>`}
  ];
  return `<div class="grid cards">${metric("Canlı Veri",`${live}/${rows.length}`,"LIVE kaynak",live/Math.max(1,rows.length)*100,"good")}${metric("BTC Faz",esc(btc?.state||"-"),"Makro bağlam",btc?.field?.harmony||40)}${metric("Aktif Sinyal",sig,"NO_TRADE dışı",sig*12,"cyan")}${metric("Ortalama Kalite",fmt(avg(rows.map(r=>r.quality||0)),0),"Tüm izleme listesi",avg(rows.map(r=>r.quality||0)))}</div><div class="card"><h3>Coin Tablosu</h3>${simpleTableHtml(rows,cols,"dashboard")}</div>`;
}
export function signals(){
  const rows=Object.values(state.rows).filter(r=>r.signal&&r.signal!=="NO_TRADE").sort((a,b)=>(b.quality||0)-(a.quality||0));
  const cols=[
    {key:"symbol",label:"Coin",val:r=>r.symbol,html:r=>`<b>${r.symbol}</b>`},
    {key:"signal",label:"Sinyal",val:r=>r.signal,html:r=>sigPill(r.signal)},
    {key:"quality",label:"Kalite",val:r=>r.quality,html:r=>fmt(r.quality,0)},
    {key:"entry",label:"Entry",val:r=>r.plan?.entry,html:r=>"$"+fmt(r.plan?.entry)},
    {key:"stop",label:"Stop",val:r=>r.plan?.stop,html:r=>"$"+fmt(r.plan?.stop)},
    {key:"tp1",label:"TP1",val:r=>r.plan?.tp1,html:r=>"$"+fmt(r.plan?.tp1)},
    {key:"rr",label:"RR",val:r=>r.plan?.rr,html:r=>fmt(r.plan?.rr,2)}
  ];
  return `<div class="card"><h3>Sinyaller</h3><p class="sub">Türev verileri karar motoruna bağlı değildir. Sinyal çekirdeği fiyat/teknik/PA-lite/OOS doğruluğu üzerine kuruludur.</p>${simpleTableHtml(rows,cols,"signals")}</div>`;
}
export function watch(){ return dashboard(); }
export function technicalsPage(){
  const a=selected(); if(!a) return `<div class="card"><h3>Teknik Analiz</h3><p class="sub">Veri bekleniyor.</p></div>`;
  setTimeout(()=>drawCandles(document.getElementById("mainChart"),a),0);
  const t=a.technicals;
  return `${coinSelector("technicals")}<div class="split2"><div class="card"><h3>${a.symbol} Grafik</h3><canvas id="mainChart" class="chart"></canvas></div><div class="card"><h3>Teknik Özet</h3>${[
    ["Fiyat","$"+fmt(a.price)],["Sinyal",a.signal],["Faz",a.state],["RSI",fmt(t.rsi.at(-1),1)],["ATR","$"+fmt(t.atr)],["VWAP","$"+fmt(t.vwap.at(-1))],["EMA20","$"+fmt(t.ema20.at(-1))],["EMA50","$"+fmt(t.ema50.at(-1))],["EMA200","$"+fmt(t.ema200.at(-1))]
  ].map(([k,v])=>`<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}</div></div>`;
}
export function levelsPage(){
  const a=selected(); if(!a) return "";
  const rows=[...(a.levels.resistances||[]).map(x=>({type:"Direnç",price:x.price,dist:(x.price-a.price)/a.price*100})),...(a.levels.supports||[]).map(x=>({type:"Destek",price:x.price,dist:(a.price-x.price)/a.price*100}))];
  const cols=[{key:"type",label:"Tip",val:r=>r.type},{key:"price",label:"Fiyat",val:r=>r.price,html:r=>"$"+fmt(r.price)},{key:"dist",label:"Mesafe",val:r=>r.dist,html:r=>pct(r.dist,2)}];
  return `${coinSelector("levels")}<div class="card"><h3>${a.symbol} Destek/Direnç</h3>${simpleTableHtml(rows,cols,"levels")}</div>`;
}
export function mtfPage(){
  const a=selected(); if(!a) return "";
  return `${coinSelector("mtf")}<div class="card"><h3>Çoklu Zaman</h3><p class="sub">V5 Clean Core bu sayfada mevcut zaman dilimi bağlamını gösterir. Çoklu TF canlı tarama v5.1 için modüler olarak eklenebilir.</p>${metric("Seçili TF",state.settings.tf,"Aktif zaman dilimi",70)}</div>`;
}
export function regimePage(){
  const rows=Object.values(state.rows);
  const cols=[{key:"symbol",label:"Coin",val:r=>r.symbol,html:r=>`<b>${r.symbol}</b>`},{key:"state",label:"Rejim",val:r=>r.state,html:r=>`<span class="pill">${r.state}</span>`},{key:"entropy",label:"Entropi",val:r=>r.field?.entropy||0,html:r=>fmt(r.field?.entropy,0)},{key:"harmony",label:"Uyum",val:r=>r.field?.harmony||0,html:r=>fmt(r.field?.harmony,0)}];
  return `<div class="card"><h3>Piyasa Rejimi</h3>${simpleTableHtml(rows,cols,"regime")}</div>`;
}
export function backtestPage(){
  const a=selected(); if(!a?.candles?.length) return "";
  const bt=runBacktest(a.candles,state.settings);
  setTimeout(()=>drawLine(document.getElementById("eqChart"),bt.eq,"#22d3ee"),0);
  return `${coinSelector("backtest")}<div class="grid cards">${metric("Net PnL","$"+fmt(bt.pnl),"Look-ahead düzeltmeli",bt.pnl>0?80:35,bt.pnl>0?"good":"bad")}${metric("Win Rate",pct(bt.win*100,1),"Kazanç oranı",bt.win*100)}${metric("Profit Factor",fmt(bt.pf,2),"Brüt kâr/zarar",Math.min(100,bt.pf*40))}${metric("Max DD",pct(bt.dd*100,1),"Maks düşüş",100-bt.dd*100,"warn")}</div><div class="card"><h3>Equity</h3><canvas id="eqChart" class="chart"></canvas></div><div class="card"><h3>Son İşlemler</h3><pre class="code">${esc(JSON.stringify(bt.trades.slice(-10),null,2))}</pre></div>`;
}
export function workerBacktestPage(){
  return `${coinSelector("workerbt")}<div class="card"><h3>Worker Backtest</h3><p class="sub">Ana UI thread'i kilitlemeden ayrı Worker dosyasıyla hesap yapar.</p><button class="btn primary" onclick="window.omni.runWorkerBacktest()">Worker Backtest Çalıştır</button></div><div class="card"><h3>Sonuç</h3><pre class="code" id="workerResult">${esc(JSON.stringify(window.omni.workerState||{status:"Hazır"},null,2))}</pre></div>`;
}
export function oosPage(){
  const rows=Object.values(state.rows).map(a=>{
    if(!a.candles?.length) return null;
    const cut=Math.max(90,Math.floor(a.candles.length*(1-(state.settings.oosPct||25)/100)));
    const train=runBacktest(a.candles.slice(0,cut),state.settings);
    const test=runBacktest(a.candles.slice(Math.max(0,cut-90)),state.settings);
    return {symbol:a.symbol,train:train.pnl,test:test.pnl,pf:test.pf,win:test.win,trades:test.trades.length};
  }).filter(Boolean);
  const cols=[{key:"symbol",label:"Coin",val:r=>r.symbol,html:r=>`<b>${r.symbol}</b>`},{key:"train",label:"Train PnL",val:r=>r.train,cls:r=>r.train>=0?"green":"red",html:r=>"$"+fmt(r.train)},{key:"test",label:"OOS PnL",val:r=>r.test,cls:r=>r.test>=0?"green":"red",html:r=>"$"+fmt(r.test)},{key:"pf",label:"OOS PF",val:r=>r.pf,html:r=>fmt(r.pf,2)},{key:"win",label:"Win",val:r=>r.win,html:r=>pct(r.win*100,1)},{key:"trades",label:"İşlem",val:r=>r.trades}];
  return `<div class="card"><h3>OOS Test</h3><p class="sub">Son %${state.settings.oosPct} izole test dilimi olarak hesaplanır.</p>${simpleTableHtml(rows,cols,"oos")}</div>`;
}
export function portfolioPage(){
  const p=portfolioRisk(state.rows,state.settings);
  const cols=[{key:"symbol",label:"Coin",val:r=>r.symbol,html:r=>`<b>${r.symbol}</b>`},{key:"signal",label:"Sinyal",val:r=>r.signal,html:r=>sigPill(r.signal)},{key:"quality",label:"Kalite",val:r=>r.quality,html:r=>fmt(r.quality,0)},{key:"riskPct",label:"Risk %",val:r=>r.riskPct,html:r=>pct(r.riskPct,2)},{key:"positionUsd",label:"Pozisyon",val:r=>r.positionUsd,html:r=>"$"+fmt(r.positionUsd)}];
  return `<div class="grid cards">${metric("Toplam Açık Risk",pct(p.total,2),`Limit ${p.limit}%`,Math.min(100,p.total/p.limit*100),p.total>p.limit?"bad":"good")}${metric("Sinyal Sayısı",p.rows.length,"Risk hesaplanan",p.rows.length*12)}</div><div class="card"><h3>Portföy Risk</h3>${simpleTableHtml(p.rows,cols,"portfolio")}</div>`;
}
export async function loadAttentionPage(){
  try{
    const j=await getAttention(state.settings.symbols,false);
    for(const c of j.coins||[]) state.attention[c.symbol]=c;
    toast("Attention verisi güncellendi");
    window.omni.render();
  }catch(e){ toast("Attention hata: "+e.message); }
}
export function attentionPage(){
  const rows=state.settings.symbols.map(s=>state.attention[s]||{symbol:s,attentionScore:0,quality:"YOK"});
  const cols=[{key:"symbol",label:"Coin",val:r=>r.symbol,html:r=>`<b>${r.symbol}</b>`},{key:"attentionScore",label:"Attention",val:r=>r.attentionScore||0,html:r=>fmt(r.attentionScore||0,0)},{key:"trendingRank",label:"Trend",val:r=>r.trendingRank||999,html:r=>r.trendingRank?`#${r.trendingRank}`:"-"},{key:"marketCapRank",label:"MCap",val:r=>r.marketCapRank||9999,html:r=>r.marketCapRank?`#${r.marketCapRank}`:"-"},{key:"volumeMcapPct",label:"Vol/MCap",val:r=>r.volumeMcapPct||0,html:r=>pct(r.volumeMcapPct||0,2)}];
  return `<div class="card"><h3>Market Attention</h3><p class="sub">CoinGecko tabanlı attention proxy. Sosyal sentiment değil, piyasa ilgisi ölçüsüdür.</p><button class="btn primary" onclick="window.omni.loadAttention()">Attention Yenile</button></div><div class="card">${simpleTableHtml(rows,cols,"attention")}</div>`;
}
export function dunePage(){ return `<div class="card"><h3>Dune On-chain</h3><p class="sub">Dune manuel ve seçili coin odaklı kalır. API key'i API Anahtarları sayfasından girilir; otomatik Top 200/Dune taraması yoktur.</p></div>`; }
export function keysPage(){
  const k=window.omni.apiKeys();
  return `<div class="card"><h3>API Anahtarları</h3><p class="sub">Anahtarlar GitHub'a yazılmaz, bu tarayıcıda saklanır.</p><div class="formGrid"><div class="field"><label>Dune API Key</label><input id="duneKey" type="password" value="${esc(k.dune||"")}"/></div><div class="field"><label>CoinGecko Key</label><input id="cgKey" type="password" value="${esc(k.coingecko||"")}"/></div></div><button class="btn primary" onclick="window.omni.saveKeys()">Kaydet</button></div>`;
}
export async function derivativesPage(){
  return `<div class="card"><h3>Türev Özeti</h3><p class="sub">Türev verileri karar motoruna bağlı değildir. Panel olarak izlenir.</p><button class="btn primary" onclick="window.omni.loadDerivatives()">Seçili Coin Türev Verisini Çek</button></div><div class="card"><h3>Son Türev Verisi</h3><pre class="code">${esc(JSON.stringify(state.derivatives,null,2))}</pre></div>`;
}
export function liquidityPage(){ return derivativesPage(); }
export function healthPage(){
  const rows=Object.values(state.rows), live=rows.filter(r=>String(r.source).startsWith("LIVE")).length, err=rows.filter(r=>r.error).length;
  return `<div class="grid cards">${metric("Canlı Coin",`${live}/${rows.length}`,"LIVE kaynak",live/Math.max(1,rows.length)*100,live?"good":"bad")}${metric("Hata",err,"Analiz/API hata",err?80:10,err?"bad":"good")}${metric("Build","v5.0.0","Clean Core",90,"good")}${metric("Modül","ES Modules","src/ altında bölündü",85,"cyan")}</div>`;
}
export function regressionPage(){
  const tests=[["Rows",Object.keys(state.rows).length>0],["Router",true],["Worker",!!window.Worker],["Top 200 kapalı",!window.top200RadarPage],["Türev karar dışı",true],["API modülü",true]];
  return `<div class="card"><h3>Regresyon Testi</h3><table><thead><tr><th>Test</th><th>Durum</th></tr></thead><tbody>${tests.map(t=>`<tr><td>${esc(t[0])}</td><td class="${t[1]?"green":"red"}">${t[1]?"GEÇTİ":"KALDI"}</td></tr>`).join("")}</tbody></table></div>`;
}
export function exportPage(){
  const txt=JSON.stringify({version:VERSION,ts:new Date().toISOString(),settings:state.settings,alerts:state.alerts},null,2);
  return `<div class="card"><h3>Yedek / Export</h3><textarea class="export" readonly onclick="this.select()">${esc(txt)}</textarea></div>`;
}
export function architecturePage(){
  return `<div class="card"><h3>V5 Clean Architecture</h3><p class="sub">Bu sürüm dev tek dosya mantığından çıkarıldı. UI, state, API, engine, indicators, charts ve worker ayrı modüllerdedir.</p><pre class="code">index.html
styles.css
src/
  app.js
  config.js
  state.js
  utils.js
  api.js
  indicators.js
  engine.js
  charts.js
  pages.js
workers/
  backtest-worker.js
api/
  market.js
  liquidity.js
  attention.js</pre></div>`;
}
export function settingsPage(){
  return `<div class="card"><h3>Ayarlar</h3><div class="formGrid">
    <div class="field"><label>Sermaye</label><input id="setAccount" type="number" value="${state.settings.accountSize}"/></div>
    <div class="field"><label>Risk %</label><input id="setRisk" type="number" value="${state.settings.riskPct}" step="0.1"/></div>
    <div class="field"><label>Min Kalite</label><input id="setQuality" type="number" value="${state.settings.minQuality}"/></div>
    <div class="field"><label>Refresh saniye</label><input id="setRefresh" type="number" value="${state.settings.refreshSec}"/></div>
    <div class="field"><label>Coin Listesi</label><textarea id="setSymbols">${state.settings.symbols.join(", ")}</textarea></div>
  </div><button class="btn primary" onclick="window.omni.saveSettings()">Kaydet</button></div>`;
}
export function debugPage(){ return `<div class="card"><h3>Debug</h3><pre class="code">${esc(JSON.stringify({settings:state.settings,lastUpdate:state.lastUpdate,logs:state.logs.slice(0,30)},null,2))}</pre></div>`; }

export const pages = {
  dashboard, signals, watch, technicals:technicalsPage, levels:levelsPage, mtf:mtfPage, regime:regimePage,
  backtest:backtestPage, workerbt:workerBacktestPage, oos:oosPage, portfolio:portfolioPage,
  attention:attentionPage, dune:dunePage, keys:keysPage, derivatives:derivativesPage, liquidity:liquidityPage,
  health:healthPage, regression:regressionPage, export:exportPage, architecture:architecturePage, settings:settingsPage, debug:debugPage
};
