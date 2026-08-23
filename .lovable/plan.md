# Daha fazla cruise line ve gemi: CruiseMapper entegrasyonu

Şu anda katalogda 5 cruise line, 8 gemi, 9 sefer ve 25 liman var. Amaç: CruiseMapper'ı Firecrawl ile tarayarak cruise line ve gemi kataloğunu ciddi biçimde genişletmek ve tarifeleri düzenli beslemek.

## Ne yapılacak

1. **CruiseMapper keşif (discovery) katmanı**
   - Firecrawl `map` ile `cruisemapper.com/cruise-lines` ve `cruisemapper.com/ships` altındaki line ve gemi sayfalarını topla.
   - Her cruise line sayfasından: şirket adı, açıklama, logo/görsel; her gemi sayfasından: gemi adı, bağlı olduğu line, kapasite, yapım yılı, açıklama, görsel.
   - Yapısal veri için Firecrawl `json` formatı (schema ile), belirsiz sayfalarda AI gateway ile markdown → JSON çıkarımı (mevcut extractor yaklaşımıyla aynı).

2. **Katalog upsert'i (line + ship öncelikli)**
   - Mevcut `import.server.ts` içindeki ensureLine/ensureShip mantığını, "sefer olmadan da line/ship kaydı oluşturup zenginleştiren" ayrı bir katalog importuna genişlet: slug bazlı upsert, `source = "cruisemapper"`, `external_id` = CruiseMapper slug'ı.
   - Var olan kayıtlar silinmez; boş alanlar (kapasite, yapım yılı, açıklama, görsel) doldurulur.
   - Tekrarlı çalıştırmada duplikasyon olmaz.

3. **Gemi tarifeleri (itinerary/schedule)**
   - CruiseMapper'ın gemi "itinerary/schedule" sayfalarından sefer + liman çağrılarını mevcut extractor ile çek; varış/kalkış saatleri ve tarihler mevcut `sailings` / `sailing_port_calls` yapısına yazılır.
   - Yeni limanlar otomatik açılır (ülke bilgisiyle).

4. **Admin kontrolü**
   - `/admin/imports` ekranına "CruiseMapper kataloğunu tara" aksiyonu: kaç line/ship/sefer eklendi-güncellendi özeti, `import_runs` geçmişine yazılır.
   - Kaç sayfa taranacağını sınırlayan bir limit alanı (varsayılan makul bir değer), böylece Firecrawl kredisi kontrollü harcanır.
   - `import_sources` tablosuna CruiseMapper kaynakları eklenir; mevcut 6 saatlik cron bunları da besler.

5. **Ön yüz**
   - Cruise line / gemi filtrelerinin artan veriyle çalıştığını doğrula; arama panelinde line ve gemi listeleri veritabanından geldiği için otomatik büyür.
   - Veri tazeliği göstergesi CruiseMapper kaynağını okunabilir etiketle gösterir ("CruiseMapper tarife verisi").

## Teknik notlar

- Yeni `src/lib/cruisemapper.server.ts`: Firecrawl map/scrape + AI çıkarımı + line/ship upsert; mevcut `firecrawlRequest` yardımcıları yeniden kullanılır (gateway/direct mod ayrımı korunur).
- Yeni admin server fonksiyonu `runCatalogImport` (`admin-import.functions.ts`), `requireSupabaseAuth` + `assertAdmin` ile korunur.
- `ships.capacity`, `year_built`, `image_url`, `cruise_lines.logo_url`/`description` alanları doldurulur; migration gerekmez.
- Tarama sırayla ve limitli yapılır (worker zaman aşımı ve Firecrawl kredisi için); büyük taramalar birden fazla çalıştırmaya bölünebilir.
- Firecrawl 402 (kredi bitti) ve 401 hataları admin ekranında net mesajla gösterilir.

## Sorular yerine varsayımlar

- İlk turda hedef: ~25-40 cruise line ve ~150+ gemi kaydı; tarife çekimi öncelikli olarak Akdeniz/Adriyatik/Kuzey Avrupa gemileri için yapılır (excursion satılan limanlarla örtüştüğü için).
