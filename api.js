
import { apiKeys } from "./state.js";

export async function getMarket(symbol, tf){
  const r = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`);
  const j = await r.json();
  if(!r.ok || j.error) throw new Error(j.error || `Market HTTP ${r.status}`);
  return j;
}
export async function getDerivatives(symbol, tf){
  const r = await fetch(`/api/liquidity?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`);
  const j = await r.json();
  if(!r.ok || j.error) throw new Error(j.error || `Liquidity HTTP ${r.status}`);
  return j;
}
export async function getAttention(symbols, includeDune=false){
  const keys=apiKeys();
  const headers = {};
  if(keys.coingecko) headers["x-omni-cg-key"] = keys.coingecko;
  if(includeDune && keys.dune) headers["x-omni-dune-key"] = keys.dune;
  const qs = new URLSearchParams({ symbols:symbols.join(","), includeDune:includeDune?"1":"0" });
  const r = await fetch(`/api/attention?${qs.toString()}`, { headers });
  const j = await r.json();
  if(!r.ok || j.error) throw new Error(j.error || `Attention HTTP ${r.status}`);
  return j;
}
