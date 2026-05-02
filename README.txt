OMNINOMICS Trade Engine v5.0.1 — Flat Upload Fix

Bu paket GitHub web arayüzünde klasör yüklerken Firefox/Eski tarayıcı çökmesini önlemek için hazırlandı.

Fark:
- src/ klasörü kaldırıldı.
- workers/ klasörü kaldırıldı.
- Frontend JS dosyaları köke taşındı.
- backtest-worker.js köke taşındı.
- api/ klasörü aynen kaldı çünkü Vercel serverless endpointleri için gerekli.

Yükleme:
1. ZIP'i aç.
2. GitHub repo kökünde eski dosyaları silmen en temiz yöntemdir.
3. Önce kökteki dosyaları yükle:
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
   vercel.json
   README.txt
   ARCHITECTURE.md
   QA_CHECKLIST.md
   OMNINOMICS_FORMULAS.md
4. Sonra api/ klasörünü yükle.
5. Commit changes.
6. Vercel deploy bitince Ctrl + F5 yap.

Not:
- Top 200 coin radar yok.
- Türev verileri karar motoruna bağlı değil.
- Dune otomatik çalışmaz.
