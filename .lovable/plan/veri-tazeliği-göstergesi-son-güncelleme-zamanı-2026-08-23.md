# Veri tazeliği göstergesi (son güncelleme zamanı)

Amaç: yolcu her sefer ve her liman çağrısı için verinin en son ne zaman güncellendiğini ve ne kadar güncel olduğunu net görsün.

## Kullanıcının göreceği şey

- Sefer başlığında bir tazelik şeridi: "Tarife 3 saat önce güncellendi · Kaynak: Celestyal · Otomatik yenileme günde 4 kez".
- Liman listesindeki her satırda küçük bir zaman etiketi (örn. "2 sa önce", "dün", "5 gün önce").
- Seçilen limanın sağ panelinde, saatlerin altında: "Varış/kalkış saatleri {tarih saat} itibarıyla" .
- Liman sayfasındaki gelen gemi tarifesi tablosunda da aynı etiket.
- Renk kodu:
  - Yeşil "Güncel" — 24 saatten yeni
  - Nötr "Son güncelleme" — 7 günden yeni
  - Amber "Doğrulanması önerilir" — 7 günden eski; yanında "Saatleri gemi programınızla teyit edin" notu.

Saatler yolcunun kendi saat dilimine göre, üzerine gelince tam tarih/saat gösteren başlıkla yazılır.

## Teknik notlar

- `sailings.updated_at`, `sailings.source`, `sailing_port_calls.updated_at` zaten mevcut; `getSailing` ve `getPort` sorgularının select listelerine eklenecek (yeni tablo/kolon gerekmiyor).
- `getSailing` dönüşüne türetilmiş bir `freshness` alanı eklenecek: sefer ile port call'ların en yeni `updated_at` değeri + kaynak etiketi.
- Yeni bileşen: `src/components/data-freshness.tsx`
  - `<FreshnessBadge updatedAt source? variant="inline|banner" />`
  - Göreli zaman biçimlendirmesi `Intl.RelativeTimeFormat` ile; sunucu/istemci farkı olmaması için değer `useEffect` sonrası hesaplanır (hidrasyon uyuşmazlığı olmaz).
- Kullanıldığı yerler:
  - `src/routes/cruises.$slug.tsx` — sefer başlığı altında banner
  - `src/components/sailing-port-explorer.tsx` — liman listesi satırları + seçili liman saat bloğu
  - `src/routes/ports.$slug.tsx` — tarife tablosu satırları
- Stil mevcut navy/brass/aqua token'ları ve ince altın hairline çizgiler ile; yeni renk sabiti eklenmez.
- İş mantığı, rezervasyon akışı ve import zamanlaması değişmez — yalnızca gösterim eklenir.
