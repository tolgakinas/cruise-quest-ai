# Ana sayfa yeniden tasarımı — arama + öne çıkan turlar

Seçilen yön: **Yuvarlak hero kartı + bindirmeli arama**. Palet Navy `#0F1D33` / Aqua `#1FA2A6` / Off-white `#F5F7FA` / Pirinç `#B99B5A`, tipografi DM Serif Display + Fira Sans. Referans mantık: shoreexcursionsgroup.com — Shore Hopper cruise satmaz, limanlardaki tur/excursion satar.

## Sayfa yapısı (yukarıdan aşağı)

1. **Hero kartı** — büyük yuvarlak köşeli (rounded-3xl) görsel kart, soldan navy gradient, sol hizalı başlık ("Excursions that redefine the shore" / TR-EN marka dili korunur) ve tek satır alt metin.
2. **Bindirmeli arama paneli** — hero kartının alt kısmına oturan beyaz/blur panel, pirinç üst çizgi, iki sekme:
   - *Cruise'a göre*: cruise hattı → gemi (seçilen hatta göre filtrelenir) → sefer tarihi
   - *Limana göre*: liman → tarih
   - Aqua "Excursion ara" butonu; sonuç `/cruises` (veya liman seçildiyse liman filtresiyle) sayfasına yönlendirir.
3. **Popüler limanlar şeridi** — liman adı + ülke etiketleri, tıklanınca liman sayfası.
4. **Öne çıkan excursion ızgarası** — 3 kolon (6 kart), kart üzerinde liman etiketi, görsel hover zoom, başlık, süre, "From" fiyat, özet; "Tüm turları gör" bağlantısı.
5. **Yaklaşan seferler** — kompakt yatay şerit (görsel değil, tarih + gemi + gece sayısı), turların hangi seferlerde bulunabileceğini göstermek için; cruise satış dili yok.
6. **Güven şeridi** — güvenli ödeme, gemiye zamanında dönüş garantisi, lisanslı yerel rehberler, kolay iptal/değişiklik.

## Teknik notlar

- `src/routes/index.tsx` yeniden yazılır; SEO `head()` (title/description/og) korunur ve güncellenir.
- Arama paneli yeni bir bileşen olarak ayrılır: `src/components/home-search-panel.tsx` (sekmeler + alanlar, yönlendirme mantığı istemci tarafında).
- Veri: mevcut `getHomeShowcase` (seferler, turlar, limanlar) ve `getSearchFacets` (hatlar, gemiler, limanlar, bölgeler) sunucu fonksiyonları route loader'ında `ensureQueryData` ile çekilir; yeni sorgu yazılmasına gerek yok. Tur kartlarında görsel için mevcut `image_url` alanı, boşsa bölgesel görsel yedeği kullanılır.
- Renkler `src/styles.css` içindeki semantic token'lara yazılır (aqua vurgu için yeni `--accent`/`--ring` değerleri oklch olarak eklenir); bileşenlerde hex/`text-white` gibi sabit sınıf kullanılmaz. Pirinç hairline ve gölge token'ları da orada tanımlanır.
- Aqua vurgu tüm sitede tutarlı olsun diye header/footer ve buton varyantları yeni token'ları otomatik alır; başka sayfaların yapısı değiştirilmez.
- Yeni hero görseli üretilir (tropik/akdeniz liman, gün batımı) ve `src/assets` içine ES6 import ile eklenir.
- Mobilde: hero kartı üstte, arama paneli kartın altına akar (bindirme yalnız masaüstünde).

## Kapsam dışı

Cruise kabin fiyatlaması/satışı, blog, bülten bölümü eklenmez. Rezervasyon akışı, admin paneli ve mevcut veritabanı değişmez.
