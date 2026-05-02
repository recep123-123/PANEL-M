
import { DEFAULT_SETTINGS } from "./config.js";

const KEY = "omninomics_v5_state";

function mergeSettings(saved){
  return { ...DEFAULT_SETTINGS, ...(saved || {}), symbols: saved?.symbols?.length ? saved.symbols : DEFAULT_SETTINGS.symbols };
}

export const state = {
  page: "dashboard",
  settings: mergeSettings(JSON.parse(localStorage.getItem(KEY) || "{}").settings),
  rows: {},
  raw: {},
  attention: {},
  derivatives: null,
  selected: "BTCUSDT",
  sort: {},
  logs: [],
  alerts: [],
  loading: false,
  lastUpdate: null,
  regression: []
};

export function save(){
  const payload = { settings: state.settings, alerts: state.alerts.slice(0,80) };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function log(msg){
  state.logs.unshift(`${new Date().toLocaleTimeString("tr-TR")} ${String(msg).replace(/[<>]/g,"").slice(0,500)}`);
  state.logs = state.logs.slice(0,180);
}

export function setSort(table, key){
  const s = state.sort[table] || {};
  state.sort[table] = { key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" };
}

export function apiKeys(){
  try { return JSON.parse(localStorage.getItem("omni_v5_api_keys") || "{}"); } catch { return {}; }
}
export function setApiKeys(keys){
  localStorage.setItem("omni_v5_api_keys", JSON.stringify(keys || {}));
}
