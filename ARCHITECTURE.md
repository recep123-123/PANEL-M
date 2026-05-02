# OMNINOMICS v5.0.1 Architecture — Flat Upload Fix

## Neden flat paket?
GitHub web upload sırasında bazı tarayıcılarda klasör yükleme çökebiliyor. Bu paket, özellikle `src/` klasörü upload edilirken yaşanan çökme için frontend dosyalarını köke taşır.

## Dosya yapısı
index.html
styles.css
app.js
config.js
state.js
utils.js
api.js
indicators.js
engine.js
charts.js
pages.js
backtest-worker.js
api/
  market.js
  liquidity.js
  attention.js

## Mimari
Kod hâlâ modülerdir; sadece klasörsüz hale getirilmiştir. ES Module importları kök dosyalar arasında çalışır.

## Bilinçli dışarıda bırakılanlar
- Top 200 radar.
- Türev verilerini karar motoruna bağlama.
- Otomatik Dune tarama.
