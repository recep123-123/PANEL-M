
export const VERSION = "5.0.1";

export const TIMEFRAMES = ["5m","15m","1h","4h","1d"];

export const DEFAULT_SYMBOLS = [
  "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","ADAUSDT","AVAXUSDT","LINKUSDT",
  "DOGEUSDT","TONUSDT","AAVEUSDT","PLUMEUSDT","TURBOUSDT","AIXBTUSDT","ETHFIUSDT",
  "TIAUSDT","ORDIUSDT","TAOUSDT","NEIROUSDT"
];

export const DEFAULT_SETTINGS = {
  symbols: DEFAULT_SYMBOLS,
  tf: "1h",
  refreshSec: 45,
  accountSize: 10000,
  riskPct: 1,
  maxPositionPct: 50,
  maxTotalRiskPct: 5,
  dataMode: "LIVE_ONLY",
  minQuality: 62,
  entropyMax: 75,
  oosPct: 25
};

export const NAV_GROUPS = [
  ["Genel Bakış", [
    ["dashboard","Ana Panel"],
    ["signals","Sinyaller"],
    ["watch","İzleme Listesi"]
  ]],
  ["Teknik Analiz", [
    ["technicals","Teknik Analiz"],
    ["levels","Destek/Direnç"],
    ["mtf","Çoklu Zaman"],
    ["regime","Piyasa Rejimi"]
  ]],
  ["Backtest ve Araştırma", [
    ["backtest","Backtest"],
    ["workerbt","Worker Backtest"],
    ["oos","OOS Test"],
    ["portfolio","Portföy Risk"]
  ]],
  ["Sosyal & On-chain", [
    ["attention","Market Attention"],
    ["dune","Dune On-chain"],
    ["keys","API Anahtarları"]
  ]],
  ["Türev & Likidite", [
    ["derivatives","Türev Özeti"],
    ["liquidity","Likidite Haritası"]
  ]],
  ["Sistem", [
    ["health","Sistem Sağlığı"],
    ["regression","Regresyon Testi"],
    ["export","Yedek/Export"],
    ["architecture","Mimari"],
    ["settings","Ayarlar"],
    ["debug","Debug"]
  ]]
];

export const PAGE_NAMES = Object.fromEntries(NAV_GROUPS.flatMap(g => g[1]));
