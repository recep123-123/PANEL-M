
export const $ = id => document.getElementById(id);

export function esc(v){
  return String(v ?? "").replace(/[&<>"]/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[ch]));
}

export function fmt(v, d=2){
  v = Number(v);
  if(!Number.isFinite(v)) return "-";
  if(Math.abs(v) >= 1_000_000_000) return (v/1_000_000_000).toFixed(2)+"B";
  if(Math.abs(v) >= 1_000_000) return (v/1_000_000).toFixed(2)+"M";
  if(Math.abs(v) >= 1_000) return v.toLocaleString("en-US", {maximumFractionDigits:d});
  if(Math.abs(v) > 0 && Math.abs(v) < .001) return v.toExponential(2);
  return v.toLocaleString("en-US", {maximumFractionDigits:d});
}

export function pct(v,d=2){ return (Number.isFinite(+v) ? (+v).toFixed(d) : "-") + "%"; }
export function signed(v,d=2){ v=+v; return Number.isFinite(v) ? (v>=0?"+":"")+v.toFixed(d) : "-"; }
export function clamp(v,a=0,b=100){ return Math.max(a, Math.min(b, +v || 0)); }
export function avg(a){ a=(a||[]).filter(x=>Number.isFinite(+x)); return a.length ? a.reduce((s,x)=>s+(+x),0)/a.length : 0; }
export function last(a,n){ return (a||[]).slice(Math.max(0,(a||[]).length-n)); }
export function compact(v){ return fmt(v,2); }

export function toast(msg){
  const host = $("toastHost");
  if(!host) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = String(msg || "");
  host.appendChild(el);
  setTimeout(() => { el.style.opacity="0"; el.style.transform="translateY(8px)"; setTimeout(()=>el.remove(),300); }, 2800);
}

export function sortRows(rows, key, dir="desc"){
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a,b) => {
    const av = typeof key === "function" ? key(a) : a[key];
    const bv = typeof key === "function" ? key(b) : b[key];
    if(typeof av === "number" && typeof bv === "number") return (av-bv)*mul;
    return String(av ?? "").localeCompare(String(bv ?? "")) * mul;
  });
}

export function table(rows, cols, sortState, onSort){
  const sorted = sortState?.key ? sortRows(rows, r => cols.find(c=>c.key===sortState.key)?.val?.(r) ?? r[sortState.key], sortState.dir) : rows;
  return `<div class="tableShell"><table><thead><tr>${cols.map(c=>{
    const arrow = sortState?.key===c.key ? (sortState.dir==="asc"?"▲":"▼") : "↕";
    return `<th data-sort="${esc(c.key)}">${esc(c.label)} ${arrow}</th>`;
  }).join("")}</tr></thead><tbody>${sorted.map(r=>`<tr>${cols.map(c=>`<td class="${c.cls?c.cls(r):""}">${c.html?c.html(r):esc(c.val?c.val(r):r[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

export function sigClass(sig){
  if(String(sig).includes("LONG")) return "good";
  if(String(sig).includes("SHORT")) return "bad";
  if(String(sig).includes("WAIT")) return "warn";
  return "";
}
export function sigPill(sig){ return `<span class="pill ${sigClass(sig)}">${esc(sig||"NO_TRADE")}</span>`; }
