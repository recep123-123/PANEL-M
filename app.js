
import { NAV_GROUPS, PAGE_NAMES, TIMEFRAMES } from "./config.js";
import { state, save, log, setSort, apiKeys, setApiKeys } from "./state.js";
import { $, esc, toast } from "./utils.js";
import { getMarket, getDerivatives } from "./api.js";
import { analyze, btcContext } from "./engine.js";
import { pages, loadAttentionPage } from "./pages.js";

let refreshTimer = null;
let refreshSeq = 0;
window.omni = {
  state,
  workerState: {status:"Hazır"},
  render,
  go,
  selectCoin(sym){ state.selected=sym; render(); },
  loadAttention: loadAttentionPage,
  apiKeys,
  saveKeys(){
    setApiKeys({dune:$("duneKey")?.value||"", coingecko:$("cgKey")?.value||""});
    toast("API anahtarları bu tarayıcıya kaydedildi");
    render();
  },
  async loadDerivatives(){
    try{
      state.derivatives = await getDerivatives(state.selected, state.settings.tf);
      toast("Türev verisi geldi");
    }catch(e){ state.derivatives={error:e.message}; toast("Türev hata: "+e.message); }
    render();
  },
  saveSettings(){
    state.settings.accountSize=+$("setAccount").value||10000;
    state.settings.riskPct=+$("setRisk").value||1;
    state.settings.minQuality=+$("setQuality").value||62;
    state.settings.refreshSec=+$("setRefresh").value||45;
    state.settings.symbols=($("setSymbols").value||"BTCUSDT").split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
    if(!state.settings.symbols.includes(state.selected)) state.selected=state.settings.symbols[0];
    save(); resetTimer(); toast("Ayarlar kaydedildi"); refresh();
  },
  runWorkerBacktest(){
    const a=state.rows[state.selected];
    if(!a?.candles?.length){ toast("Seçili coin için veri yok"); return; }
    const w=new Worker("/backtest-worker.js");
    window.omni.workerState={status:"Çalışıyor",symbol:state.selected};
    render();
    const t0=performance.now();
    w.onmessage=ev=>{
      window.omni.workerState={...ev.data,ms:Math.round(performance.now()-t0)};
      w.terminate(); render();
    };
    w.onerror=e=>{ window.omni.workerState={type:"error",error:e.message}; w.terminate(); render(); };
    w.postMessage({candles:a.candles,settings:state.settings,symbol:state.selected});
  }
};

function navHtml(mobile=false){
  return NAV_GROUPS.map(([title,items])=>{
    const content=items.map(([id,name])=>`<button class="navItem ${state.page===id?"active":""}" data-page="${id}">${esc(name)}</button>`).join("");
    return mobile ? `<details ${items.some(i=>i[0]===state.page)?"open":""}><summary>${esc(title)}</summary><div class="navItems">${content}</div></details>` :
      `<div class="navGroup"><div class="navTitle">${esc(title)}</div><div class="navItems">${content}</div></div>`;
  }).join("");
}
function bindNav(){
  document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
}
function go(page){ state.page=page; render(); }
function setStatus(kind,msg){
  const el=$("status"); if(!el)return;
  el.className="status "+kind;
  el.textContent = kind==="loading" ? "● YÜKLENİYOR" : kind==="err" ? "● DATA ERROR" : "● CANLI VERİ";
}
export function render(){
  $("sideNav").innerHTML=navHtml(false);
  $("mobileNav").innerHTML=navHtml(true);
  bindNav();
  $("tfSelect").value=state.settings.tf;
  const fn=pages[state.page] || pages.dashboard;
  try{ $("view").innerHTML=fn(); }
  catch(e){ $("view").innerHTML=`<div class="card"><h3>Render Hatası</h3><p class="sub">${esc(e.message)}</p></div>`; console.error(e); }
  bindSorts();
}
function bindSorts(){
  document.querySelectorAll("th[data-sort]").forEach(th=>th.addEventListener("click",()=>{
    const tableId=th.closest("[data-table]")?.dataset.table;
    if(tableId){ setSort(tableId, th.dataset.sort); render(); }
  }));
}
async function refresh(){
  if(state.loading) return;
  const seq=++refreshSeq;
  state.loading=true; setStatus("loading"); render();
  try{
    const raw={};
    const results=await Promise.allSettled(state.settings.symbols.map(s=>getMarket(s,state.settings.tf)));
    for(const r of results){
      if(r.status==="fulfilled") raw[r.value.symbol]=r.value;
      else log("Market hata: "+r.reason?.message);
    }
    if(seq!==refreshSeq) return;
    const initialRows={};
    for(const s of state.settings.symbols){
      const m=raw[s];
      initialRows[s]=analyze(s,m?.candles||[],state.settings,null,m?.source||"VERİ HATASI");
    }
    const btcCtx=btcContext(initialRows);
    const rows={};
    for(const s of state.settings.symbols){
      const m=raw[s];
      rows[s]=analyze(s,m?.candles||[],state.settings,btcCtx,m?.source||"VERİ HATASI");
    }
    state.raw=raw; state.rows=rows; state.lastUpdate=Date.now();
    setStatus(Object.values(rows).some(r=>String(r.source).startsWith("LIVE"))?"live":"err");
  }catch(e){
    log("Refresh hata: "+e.message);
    setStatus("err");
  }finally{
    state.loading=false; save(); render();
  }
}
function resetTimer(){
  if(refreshTimer) clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>{ if(!["backtest","workerbt","oos"].includes(state.page)) refresh(); }, Math.max(20,state.settings.refreshSec||45)*1000);
}

function init(){
  $("tfSelect").innerHTML=TIMEFRAMES.map(tf=>`<option ${tf===state.settings.tf?"selected":""}>${tf}</option>`).join("");
  $("tfSelect").addEventListener("change",e=>{state.settings.tf=e.target.value; save(); refresh();});
  $("refreshBtn").addEventListener("click",refresh);
  resetTimer();
  render();
  refresh();
}
init();
