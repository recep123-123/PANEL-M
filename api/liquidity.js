
const BINANCE_F = [
  "https://fapi.binance.com",
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
  "https://fapi3.binance.com"
];
const BINANCE_S = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com"
];
const OKX = "https://www.okx.com";
const COINBASE_EX = [
  "https://api.exchange.coinbase.com",
  "https://api.pro.coinbase.com"
];
const COINBASE_SPOT = "https://api.coinbase.com";

const TF_PERIOD = { "5m":"5m", "15m":"15m", "1h":"1h", "4h":"4h", "1d":"1d" };
const TF_INTERVAL = { "5m":"5m", "15m":"15m", "1h":"1h", "4h":"4h", "1d":"1d" };
const OKX_BAR = { "5m":"5m", "15m":"15m", "1h":"1H", "4h":"4H", "1d":"1D" };
const CB_GRAN = { "5m":300, "15m":900, "1h":3600, "4h":14400, "1d":86400 };

function num(v){ v=Number(v); return Number.isFinite(v)?v:null; }
function nz(v,d=0){ v=num(v); return v===null?d:v; }
function round(n,d=4){ n=nz(n,0); const p=Math.pow(10,d); return Math.round(n*p)/p; }
function baseFromSymbol(symbol){
  symbol=String(symbol||"BTCUSDT").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(symbol.endsWith("USDT")) return symbol.slice(0,-4);
  if(symbol.endsWith("USD")) return symbol.slice(0,-3);
  return symbol;
}
function toSymbol(base){ return `${base}USDT`; }
async function getJson(url, timeout=5000){
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const r=await fetch(url,{signal:ctrl.signal,headers:{"accept":"application/json","user-agent":"OmninomicsTradeEngine/1.0"}});
    const text=await r.text();
    let json; try{json=JSON.parse(text)}catch{json=text}
    if(!r.ok) throw new Error(`HTTP ${r.status}: ${typeof json==="string"?json.slice(0,150):JSON.stringify(json).slice(0,150)}`);
    return json;
  }finally{clearTimeout(t)}
}
async function tryUrls(urls,label,debugErrors,fallback=null){
  const attempts = urls.map(url => getJson(url).then(data=>({ok:true,data,url})).catch(e=>({ok:false,error:e,url})));
  const results = await Promise.allSettled(attempts);
  for(const r of results){
    const v = r.value;
    if(v && v.ok) return v.data;
  }
  for(const r of results){
    const v = r.value;
    if(v && !v.ok) debugErrors.push(`${label}: ${v.error?.message||String(v.error)}`.slice(0,220));
  }
  return fallback;
}
function normalizeBinanceKlines(rows){
  return (rows||[]).map(r=>({time:nz(r[0]),open:nz(r[1]),high:nz(r[2]),low:nz(r[3]),close:nz(r[4]),volume:nz(r[5])})).filter(x=>x.close);
}
function normalizeOkxCandles(rows){
  return (rows||[]).map(r=>({time:nz(r[0]),open:nz(r[1]),high:nz(r[2]),low:nz(r[3]),close:nz(r[4]),volume:nz(r[5])})).filter(x=>x.close).reverse();
}
function normalizeCoinbaseCandles(rows){
  return (rows||[]).map(r=>({time:nz(r[0])*1000,low:nz(r[1]),high:nz(r[2]),open:nz(r[3]),close:nz(r[4]),volume:nz(r[5])})).filter(x=>x.close).sort((a,b)=>a.time-b.time);
}
function nearestByTime(rows,t){
  if(!rows?.length)return null;
  let best=rows[0],bd=Math.abs(rows[0].time-t);
  for(const r of rows){const d=Math.abs(r.time-t); if(d<bd){best=r;bd=d}}
  return best;
}
function normalizeDepthBinance(depth){
  return {
    bids:(depth?.bids||[]).map(x=>[nz(x[0]),nz(x[1])]).filter(x=>x[0]&&x[1]),
    asks:(depth?.asks||[]).map(x=>[nz(x[0]),nz(x[1])]).filter(x=>x[0]&&x[1])
  };
}
function normalizeDepthOkx(j){
  const d=j?.data?.[0]||{};
  return {
    bids:(d.bids||[]).map(x=>[nz(x[0]),nz(x[1])]).filter(x=>x[0]&&x[1]),
    asks:(d.asks||[]).map(x=>[nz(x[0]),nz(x[1])]).filter(x=>x[0]&&x[1])
  };
}
function first(j){ return j?.data?.[0] || null; }
function seriesFromBinanceRatio(rows,key="longShortRatio"){
  return (rows||[]).map(x=>({time:nz(x.timestamp),value:nz(x[key])})).filter(x=>x.time&&x.value!==null);
}

async function netlifyHandler(event){
  const headers={
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Allow-Methods":"GET, OPTIONS",
    "Cache-Control":"public, max-age=20"
  };
  if(event.httpMethod==="OPTIONS") return {statusCode:204,headers,body:""};

  const rawSymbol=String(event.queryStringParameters?.symbol||"BTCUSDT").toUpperCase();
  const base=baseFromSymbol(rawSymbol);
  const symbol=toSymbol(base);
  const okxSwap=`${base}-USDT-SWAP`;
  const okxSpot=`${base}-USDT`;
  const cbProduct=`${base}-USD`;
  const tf=String(event.queryStringParameters?.tf||"1h");
  const period=TF_PERIOD[tf]||"1h";
  const interval=TF_INTERVAL[tf]||"1h";
  const okxBar=OKX_BAR[tf]||"1H";
  const gran=CB_GRAN[tf]||3600;
  const debugErrors=[];
  const sources=[];

  try{
    const [
      binPremium, binOpenInterest, binFundingHistory, binOiHist, binGlobalRatio, binTopRatio,
      binTakerRatio, binDepth, binKlines, binSpotTicker, binSpotKlines,
      okxFunding, okxOpenInterest, okxMark, okxBooks, okxCandles, okxSpotTicker, okxSwapTicker,
      coinbaseTickerRaw, coinbaseCandlesRaw
    ] = await Promise.all([
      tryUrls(BINANCE_F.map(b=>`${b}/fapi/v1/premiumIndex?symbol=${symbol}`),"Binance premiumIndex",debugErrors),
      tryUrls(BINANCE_F.map(b=>`${b}/fapi/v1/openInterest?symbol=${symbol}`),"Binance openInterest",debugErrors),
      tryUrls(BINANCE_F.map(b=>`${b}/fapi/v1/fundingRate?symbol=${symbol}&limit=50`),"Binance fundingRate",debugErrors,[]),
      tryUrls(BINANCE_F.map(b=>`${b}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=50`),"Binance OI hist",debugErrors,[]),
      tryUrls(BINANCE_F.map(b=>`${b}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=40`),"Binance global L/S",debugErrors,[]),
      tryUrls(BINANCE_F.map(b=>`${b}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=40`),"Binance top trader L/S",debugErrors,[]),
      tryUrls(BINANCE_F.map(b=>`${b}/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=40`),"Binance taker ratio",debugErrors,[]),
      tryUrls(BINANCE_F.map(b=>`${b}/fapi/v1/depth?symbol=${symbol}&limit=500`),"Binance futures depth",debugErrors),
      tryUrls(BINANCE_F.map(b=>`${b}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=90`),"Binance futures klines",debugErrors),
      tryUrls(BINANCE_S.map(b=>`${b}/api/v3/ticker/price?symbol=${symbol}`),"Binance spot ticker",debugErrors),
      tryUrls(BINANCE_S.map(b=>`${b}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=90`),"Binance spot klines",debugErrors,[]),
      getJson(`${OKX}/api/v5/public/funding-rate?instId=${okxSwap}`).catch(e=>{debugErrors.push(`OKX funding: ${e.message||e}`);return null}),
      getJson(`${OKX}/api/v5/public/open-interest?instType=SWAP&instId=${okxSwap}`).catch(e=>{debugErrors.push(`OKX OI: ${e.message||e}`);return null}),
      getJson(`${OKX}/api/v5/public/mark-price?instType=SWAP&instId=${okxSwap}`).catch(e=>{debugErrors.push(`OKX mark: ${e.message||e}`);return null}),
      getJson(`${OKX}/api/v5/market/books?instId=${okxSwap}&sz=400`).catch(e=>{debugErrors.push(`OKX books: ${e.message||e}`);return null}),
      getJson(`${OKX}/api/v5/market/candles?instId=${okxSwap}&bar=${okxBar}&limit=90`).catch(e=>{debugErrors.push(`OKX candles: ${e.message||e}`);return null}),
      getJson(`${OKX}/api/v5/market/ticker?instId=${okxSpot}`).catch(e=>{debugErrors.push(`OKX spot ticker: ${e.message||e}`);return null}),
      getJson(`${OKX}/api/v5/market/ticker?instId=${okxSwap}`).catch(e=>{debugErrors.push(`OKX swap ticker: ${e.message||e}`);return null}),
      (async()=>{
        for(const b of COINBASE_EX){try{return await getJson(`${b}/products/${cbProduct}/ticker`)}catch(e){debugErrors.push(`Coinbase ticker: ${e.message||e}`)}}
        try{return await getJson(`${COINBASE_SPOT}/v2/prices/${cbProduct}/spot`)}catch(e){debugErrors.push(`Coinbase spot: ${e.message||e}`);return null}
      })(),
      (async()=>{
        for(const b of COINBASE_EX){try{return await getJson(`${b}/products/${cbProduct}/candles?granularity=${gran}`)}catch(e){debugErrors.push(`Coinbase candles: ${e.message||e}`)}}
        return [];
      })()
    ]);

    if(binPremium||binKlines||binDepth) sources.push("BINANCE");
    if(okxFunding||okxOpenInterest||okxBooks||okxCandles) sources.push("OKX YEDEK");
    if(coinbaseTickerRaw) sources.push("COINBASE");

    const okxMarkRow=first(okxMark);
    const okxOiRow=first(okxOpenInterest);
    const okxFundingRow=first(okxFunding);
    const okxSpotRow=first(okxSpotTicker);
    const okxSwapRow=first(okxSwapTicker);

    const futureK = binKlines ? normalizeBinanceKlines(binKlines) : normalizeOkxCandles(okxCandles?.data || []);
    const spotKBinance = normalizeBinanceKlines(binSpotKlines || []);
    const spotKCoinbase = normalizeCoinbaseCandles(coinbaseCandlesRaw || []);

    const fallbackFuturePrice =
      nz(binPremium?.markPrice,null) ??
      nz(binPremium?.lastPrice,null) ??
      nz(okxMarkRow?.markPx,null) ??
      nz(okxSwapRow?.last,null) ??
      nz(futureK[futureK.length-1]?.close,null);

    let cbTicker = coinbaseTickerRaw && coinbaseTickerRaw.data ? {price:coinbaseTickerRaw.data.amount} : coinbaseTickerRaw;
    const coinbasePrice = nz(cbTicker?.price,null) ?? nz(cbTicker?.ask,null) ?? nz(cbTicker?.bid,null);
    const binanceSpotPrice = nz(binSpotTicker?.price,null);
    const okxSpotPrice = nz(okxSpotRow?.last,null);

    let spotPrice=null, spotSource="YOK", spotK=[];
    if(coinbasePrice){ spotPrice=coinbasePrice; spotSource="COINBASE SPOT"; spotK=spotKCoinbase; }
    else if(binanceSpotPrice){ spotPrice=binanceSpotPrice; spotSource="BINANCE SPOT"; spotK=spotKBinance; }
    else if(okxSpotPrice){ spotPrice=okxSpotPrice; spotSource="OKX SPOT"; spotK=[]; }

    const markPrice = nz(binPremium?.markPrice,null) ?? nz(okxMarkRow?.markPx,null) ?? fallbackFuturePrice;
    const futuresPrice = nz(binPremium?.lastPrice,null) ?? nz(okxSwapRow?.last,null) ?? markPrice;
    const indexPrice = nz(binPremium?.indexPrice,null) ?? nz(okxMarkRow?.idxPx,null) ?? spotPrice ?? futuresPrice;

    const premiumUsdNow = spotPrice && futuresPrice ? round(spotPrice - futuresPrice, 6) : null;
    const premiumPctNow = spotPrice && futuresPrice ? round((spotPrice - futuresPrice)/(futuresPrice||1)*100, 5) : null;

    const premiumUsd=[], premiumPct=[];
    if(spotK.length && futureK.length){
      for(const s of spotK){
        const f=nearestByTime(futureK,s.time);
        if(!f?.close||!s.close)continue;
        const usd=s.close-f.close;
        premiumUsd.push({time:s.time,value:round(usd,6)});
        premiumPct.push({time:s.time,value:round(usd/(f.close||1)*100,5)});
      }
    }

    const oiCoin = nz(binOpenInterest?.openInterest,null) ?? nz(okxOiRow?.oiCcy,null) ?? nz(okxOiRow?.oi,null);
    const oiUsd = nz((binOiHist||[])[(binOiHist||[]).length-1]?.sumOpenInterestValue,null) ??
      nz(okxOiRow?.oiUsd,null) ??
      (oiCoin && futuresPrice ? round(oiCoin*futuresPrice,2) : null);

    const oiSeries=(binOiHist||[]).map(x=>({time:nz(x.timestamp),value:nz(x.sumOpenInterestValue)})).filter(x=>x.time&&x.value!==null);
    const fundingSeries=(binFundingHistory||[]).map(x=>({time:nz(x.fundingTime),value:round(nz(x.fundingRate,0)*100,5)})).filter(x=>x.time);
    const lastFundingRatePct = nz(binPremium?.lastFundingRate,null)!==null ? round(nz(binPremium.lastFundingRate)*100,5) :
      (nz(okxFundingRow?.fundingRate,null)!==null ? round(nz(okxFundingRow.fundingRate)*100,5) : null);

    if(!fundingSeries.length && lastFundingRatePct!==null) fundingSeries.push({time:Date.now(),value:lastFundingRatePct});

    const basisSeries = futureK.map(k=>({time:k.time,value:indexPrice?round((k.close-indexPrice)/(indexPrice||1)*100,5):null})).filter(x=>x.value!==null);
    const globalSeries=seriesFromBinanceRatio(binGlobalRatio);
    const topSeries=seriesFromBinanceRatio(binTopRatio);
    const takerSeries=(binTakerRatio||[]).map(x=>({time:nz(x.timestamp),value:round((nz(x.buySellRatio,1)-1)*100,3),raw:nz(x.buySellRatio)})).filter(x=>x.time);

    const globalLast=globalSeries.length?globalSeries[globalSeries.length-1].value:null;
    const topLast=topSeries.length?topSeries[topSeries.length-1].value:null;
    const takerLast=takerSeries.length?takerSeries[takerSeries.length-1].value:null;
    const basisPct = markPrice && indexPrice ? round((markPrice-indexPrice)/(indexPrice||1)*100,5) : null;
    const markIndexPct = markPrice && indexPrice ? round((markPrice-indexPrice)/(indexPrice||1)*100,5) : null;
    const depth = binDepth ? normalizeDepthBinance(binDepth) : normalizeDepthOkx(okxBooks);

    const quality={
      futures:!!(markPrice||futuresPrice),
      spot:!!spotPrice,
      premiumHistory:premiumPct.length>1,
      funding:fundingSeries.length>0,
      oiCurrent:oiUsd!==null,
      oiHistory:oiSeries.length>1,
      ratios:!!(globalSeries.length||topSeries.length||takerSeries.length),
      depth:!!(depth.bids.length||depth.asks.length)
    };

    const hasSomething = quality.futures || quality.spot || quality.funding || quality.oiCurrent || quality.ratios || quality.depth;
    if(!hasSomething){
      return {statusCode:502,headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({symbol,error:`${symbol} için Binance/OKX türev verisi alınamadı.`,debugErrors:debugErrors.slice(0,20)})};
    }

    const out={
      source:sources.length?sources.join(" + "):"PARTIAL",
      symbol,
      base,
      tf,
      debugErrors:debugErrors.slice(0,14),
      depth,
      quality,
      summary:{
        spotPrice,
        spotSource,
        futuresPrice,
        markPrice,
        indexPrice,
        premiumSource:`${spotSource} - FUTURES/MARK`,
        spotPremiumUsd:premiumUsdNow,
        spotPremiumPct:premiumPctNow,
        coinbasePrice,
        binanceSpotPrice,
        lastFundingRatePct,
        nextFundingTime:nz(binPremium?.nextFundingTime,null) ?? nz(okxFundingRow?.nextFundingTime,null),
        openInterest:oiCoin,
        openInterestUsd:oiUsd,
        globalLongShort:globalLast,
        topTraderLongShort:topLast,
        takerBias:takerLast,
        basisPct,
        markIndexPct,
        retrievedAt:Date.now()
      },
      series:{premiumPct,premiumUsd,oi:oiSeries,funding:fundingSeries,basis:basisSeries,globalRatio:globalSeries,topRatio:topSeries,taker:takerSeries}
    };

    return {statusCode:200,headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify(out)};
  }catch(e){
    return {statusCode:502,headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({symbol,error:e.message||String(e),debugErrors:debugErrors.slice(0,20)})};
  }
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
