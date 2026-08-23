# Admin Paneli + Passenger Paneli

İki ayrı panel: yönetici için tam kontrol, yolcu için kendi rezervasyonlarını yönetme alanı. Mevcut audit log ve refund ekranları yeni admin panelinin içine taşınır; mevcut rezervasyon değiştirme mantığı (tarih, kişi sayısı, iletişim, iptal) korunur ve yolcu panelinin içine yerleşir.

## Admin paneli (/admin, sadece admin rolü)

Sol kenar çubuklu kendi düzeni; her sayfa liste + düzenleme formu şeklinde.

- **Genel bakış** — rezervasyon sayısı, ciro, bekleyen ödemeler, bekleyen iade talepleri, yakın kalkışlar.
- **Cruise verisi** — cruise şirketleri, gemiler, seferler (sailing) ve gün gün liman programı (port call) düzenleyici; yayınla/yayından kaldır.
- **Limanlar** — liman şehirleri: açıklama, ülke/bölge, görsel.
- **Excursion/turlar** — oluştur, düzenle, fiyat, süre, kapasite, kategori, zorluk, görsel, liman ataması, yayın durumu; her turun ek hizmetleri (add-on) aynı ekranda yönetilir.
- **Rezervasyonlar** — filtreleme (durum, tarih, sefer), detay görünümü, durumu değiştirme (onayla / iptal), kişi sayısı ve tarih düzeltme, not ekleme, CSV dışa aktarma.
- **İade talepleri** — mevcut ekran (onayla/reddet, admin notu).
- **Kullanıcılar** — kayıtlı yolcular, rol verme/alma (admin / passenger).
- **Audit log** — mevcut ekran.

Admin olmayan biri /admin altına girmeye çalışırsa hesabına yönlendirilir; ayrıca her admin sunucu fonksiyonu rolü kendi içinde tekrar doğrular.

## Passenger paneli (/account)

Sol kenar çubuklu yolcu alanı; e-posta + şifre (veya Google/Apple) ile giriş.

- **Panelim** — yaklaşan turlar, ödeme durumu, hızlı bağlantılar.
- **Rezervasyonlarım** — tüm rezervasyonlar; durum, referans, tutar.
- **Rezervasyon detayı** — tur tarihini değiştir (yalnızca o limana uğranan günler ve kapasite uygunsa), kişi sayısını değiştir (fiyat yeniden hesaplanır, fark için ödeme), iletişim/kabin/not güncelle, voucher görüntüle/yazdır, iptal talebi (iade admin onayına düşer).
- **Profil** — ad, telefon, kabin numarası, e-posta; şifre değiştirme ve şifre sıfırlama e-postası.
- **Çıkış yap** — oturum ve önbellek temizliğiyle.

## Teknik notlar

- Yeni sunucu fonksiyon dosyaları: `admin-catalog.functions.ts` (cruise line/ship/sailing/port call/port CRUD), `admin-excursions.functions.ts` (tur + add-on CRUD), `admin-bookings.functions.ts` (liste, durum değişimi, düzenleme, CSV), `admin-users.functions.ts` (rol yönetimi), `admin-stats.functions.ts` (genel bakış). Hepsi `requireSupabaseAuth` + rol doğrulaması ile; rol kontrolü mevcut `has_role` üzerinden.
- Rol atama işlemi service-role istemcisiyle, sadece rolü doğrulanmış admin için, handler içinden dinamik import edilerek yapılır.
- Rota yapısı: `src/routes/_authenticated/admin/route.tsx` (kenar çubuğu düzeni + rol kapısı) altında `index`, `sailings`, `ports`, `excursions`, `bookings`, `refunds`, `users`, `audit-log`. Yolcu tarafı `src/routes/_authenticated/account/*` altında kenar çubuğu düzeniyle toplanır.
- Yazma işlemleri mevcut audit trigger'ları sayesinde otomatik olarak audit log'a düşer; rezervasyon düzenlemeleri ayrıca `booking_modifications` tablosuna yazılır.
- Fiyat, kapasite ve tarih geçerliliği yalnızca sunucuda hesaplanır; istemci tutar göndermez.
- Profil güncellemesi `profiles` tablosuna kendi satırı için yazar; RLS zaten buna izin veriyor.
- Site başlığındaki geçici "Refunds"/"Audit log" bağlantıları tek bir "Admin" bağlantısıyla değiştirilir.

## Sıra

1. Admin düzeni + rol kapısı + genel bakış.
2. Excursion ve add-on yönetimi, ardından limanlar.
3. Cruise verisi (şirket, gemi, sefer, liman programı).
4. Rezervasyon yönetimi + CSV; iade ve audit ekranlarını panele taşı.
5. Kullanıcı/rol yönetimi.
6. Passenger paneli düzeni, profil ve şifre değiştirme.
