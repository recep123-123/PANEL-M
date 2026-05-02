const TF_MEXC = { "5m":"5m", "15m":"15m", "1h":"60m", "4h":"4h", "1d":"1d" };
const TF_OKX = { "5m":"5m", "15m":"15m", "1h":"1H", "4h":"4H", "1d":"1D" };
const TF_CC = { "5m": { path:"histominute", aggregate:5 }, "15m": { path:"histominute", aggregate:15 }, "1h": { path:"histohour", aggregate:1 }, "4h": { path:"histohour", aggregate:4 }, "1d": { path:"histoday", aggregate:1 } };

function baseFromSymbol(symbol) {
  return String(symbol || "").toUpperCase().replace(/USDT$/, "");
}
function okxInst(symbol) {
  return baseFromSymbol(symbol) + "-USDT";
}
async function getJson(url, timeout = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "accept": "application/json", "user-agent": "OmninomicsTradeEngine/1.0" } });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${typeof json === "string" ? json.slice(0, 150) : JSON.stringify(json).slice(0, 150)}`);
    return json;
  } finally {
    clearTimeout(t);
  }
}
function normalizeMexcKlines(rows) {
  return rows.map(k => ({
    time: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5] || 0)
  })).filter(x => Number.isFinite(x.close));
}
function normalizeOkxKlines(rows) {
  return rows.map(k => ({
    time: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5] || 0)
  })).filter(x => Number.isFinite(x.close)).reverse();
}
function normalizeCcRows(rows) {
  return rows.map(k => ({
    time: Number(k.time) * 1000,
    open: Number(k.open),
    high: Number(k.high),
    low: Number(k.low),
    close: Number(k.close),
    volume: Number(k.volumefrom || k.volumeto || 0)
  })).filter(x => Number.isFinite(x.close));
}
async function fetchMexc(symbol, tf) {
  const interval = TF_MEXC[tf] || "60m";
  const kl = await getJson(`https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=220`);
  const ticker = await getJson(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${symbol}`).catch(() => null);
  return {
    symbol,
    source: "LIVE MEXC",
    market: "mexc",
    ticker: ticker ? { price: Number(ticker.lastPrice), change: Number(ticker.priceChangePercent || 0) } : null,
    candles: normalizeMexcKlines(kl)
  };
}
async function fetchOkx(symbol, tf) {
  const inst = okxInst(symbol);
  const bar = TF_OKX[tf] || "1H";
  const kl = await getJson(`https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(inst)}&bar=${bar}&limit=220`);
  if (kl.code !== "0") throw new Error(kl.msg || "OKX candles error");
  const tk = await getJson(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(inst)}`).catch(() => null);
  let ticker = null;
  if (tk && tk.code === "0" && tk.data && tk.data[0]) {
    const d = tk.data[0], last = Number(d.last), open24h = Number(d.open24h);
    ticker = { price: last, change: open24h ? (last - open24h) / open24h * 100 : 0 };
  }
  return { symbol, source: "LIVE OKX", market: "okx", ticker, candles: normalizeOkxKlines(kl.data || []) };
}
async function fetchCryptoCompare(symbol, tf) {
  const base = baseFromSymbol(symbol);
  const t = TF_CC[tf] || TF_CC["1h"];
  const url = `https://min-api.cryptocompare.com/data/v2/${t.path}?fsym=${encodeURIComponent(base)}&tsym=USD&limit=220&aggregate=${t.aggregate}`;
  const j = await getJson(url);
  if (!j.Data || !j.Data.Data || !j.Data.Data.length) throw new Error(j.Message || "CryptoCompare empty");
  const price = await getJson(`https://min-api.cryptocompare.com/data/price?fsym=${encodeURIComponent(base)}&tsyms=USD`).catch(() => null);
  return {
    symbol,
    source: "LIVE CRYPTOCOMPARE",
    market: "cryptocompare",
    ticker: price && price.USD ? { price: Number(price.USD), change: 0 } : null,
    candles: normalizeCcRows(j.Data.Data)
  };
}

async function netlifyHandler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=15"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const symbol = String(event.queryStringParameters?.symbol || "BTCUSDT").toUpperCase();
  const tf = String(event.queryStringParameters?.tf || "1h");
  const errors = [];

  for (const fn of [fetchMexc, fetchOkx, fetchCryptoCompare]) {
    try {
      const result = await fn(symbol, tf);
      if (result.candles && result.candles.length) {
        return { statusCode: 200, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(result) };
      }
      errors.push(`${fn.name}: empty`);
    } catch (e) {
      errors.push(`${fn.name}: ${e.message || String(e)}`);
    }
  }

  return {
    statusCode: 502,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, source: "DATA ERROR", market: "none", candles: [], ticker: null, error: errors.join(" | ") })
  };
};

module.exports = async function handler(req, res) {
  const event = {
    httpMethod: req.method || "GET",
    queryStringParameters: req.query || {}
  };

  const result = await netlifyHandler(event);
  const headers = result.headers || {};
  for (const [key, value] of Object.entries(headers)) {
    try { res.setHeader(key, value); } catch {}
  }
  res.status(result.statusCode || 200).send(result.body || "");
};
