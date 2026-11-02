---
name: gauntlet-loop
description: Verification loop for implementing and fixing code, scripts, or executable configurations. Drives compact spec derivation, bounded implementation, self-check, proportionate verification, and capped repairs, with independent review for substantial changes.
metadata:
  short-description: Code implementation and proportionate verification loop
---

# Gauntlet Loop

Kod, script veya çalıştırılabilir konfigürasyon değişikliklerinde uygulanan doğrulama ve kalite döngüsüdür. Varsayımlara değil; somut hedefe, duruma uygun doğrulamaya ve gözlenen çalışma kanıtına dayanır.

## Kapsam ve Devreye Girme

- **Varsayılan kapsam:** Kod, script veya çalıştırılabilir konfigürasyon yazma, hata düzeltme ve refactor taleplerinde otomatik devreye girer.
- **Açık çağrı:** Kullanıcı `/gauntlet-loop`, `$gauntlet-loop` dediğinde veya somut bir artifact için kalite turu istediğinde çalışır.
- **Kapsam dışı:** Salt okuma, araştırma, mimari tartışma ve sadece planlama talepleri kod değişikliği başlatmaz.
- **Alt görev sınırları:** Atanmış worker veya reviewer alt görevleri yalnızca kendi bounded sözleşmesini yürütür; üst döngüyü özyinelemeli olarak asla yeniden başlatamaz.

## 1. Bağlamı Topla ve Kompakt Spec Çıkar

1. Mevcut bağlamı, önceki kararları ve son devir (handoff) durumunu toparla; eldeki bilgi yeterliyse kullanıcıya soru tekrarlama.
2. İş zaten Notion takibi içeriyorsa ilgili görev kaydını oku ve güncelle; yerel işlerde harici Notion arama veya hazırlığı yapma, yerel bağlamı kullan.
3. İşe başlamadan önce kompakt spec sözleşmesini dondur:

```text
OUTCOME:    <ulaşılacak tek somut sonuç>
SOURCE:     <ilgili dosyalar, branch, dirty diff ve dokümanlar>
CONSTRAINT: <kapsam sınırları, bozulmayacak API/davranışlar, sıfır spekülatif ek>
CHECK:      <çalıştırılacak kesin komutlar ve ikili (binary) kabul kriterleri>
OWNER:      <tek yürütücü/oturum, mevcut görev kaydı ve sıradaki adım>
```

4. Kabul kriterleri sonradan keyfi gevşetilemez veya değiştirilemez; yazar ya da reviewer kriteri değiştirerek PASS veremez.

## 2. Sınırlı Değişiklik ve Yazar Öz-Kontrolü

1. En küçük eksiksiz değişikliği mevcut repo konvansiyonlarıyla yap; gereksiz dosya üretme veya alakasız yerleri düzenleme.
2. Değişikliği yapan yazar kendi öz-kontrolünü (self-check) çalıştırır ve kanıtı yapılandırır:

```text
RESULT:       <ne değişti>
CHECK:        <çalıştırılan kesin test/kontrol komutları>
EVIDENCE:     <ham terminal çıktısı, log veya gözlenen sonuç>
KNOWN ISSUES: <kanıtlanmayan veya açıkta kalan noktalar>
```

3. Yazarın "tamamlandı" demesi, scaffold'ın derlenmesi veya daraltılmış testler tek başına nihai kanıt sayılmaz.

## 3. İnceleme ve Bağımsız Denetim (Proportionate Review)

1. **Bağımsız inceleme eşiği:** Bileşenler arası davranış değişikliklerinde, güvenlik veya veri sınırlarında, migrasyonlarda ve kullanıcı açıkça istediğinde bağımsız reviewer zorunludur. Küçük ve geri alınabilir değişikliklerde ilgili test ve kontroller yeterlidir.
2. Bağımsız review gerektiğinde: Değişikliği bizzat yazmamış, salt-okuma ve test yetkili bağımsız bir reviewer çalıştır.
   Başlatma aracından dönen gerçek reviewer oturum/task kimliğini ve o reviewer'dan gelen sonucu kaydet. Yalnız başlatma niyeti, boş bir wait sonucu veya yazarın "review PASS" cümlesi inceleme kanıtı değildir; sonuç alınamadıysa `BLOCKED/PARTIAL` kalır.
3. Reviewer'a yazarın çıkarımlarını/savunmalarını değil; orijinal görev/spec ile çalışma ağacının güncel durumunu (`git diff`, untracked dosyalar, HEAD) ilet.
4. Reviewer kodu değiştirmez, kriterleri gevşetmez, alt-agent açmaz. Çıktı formatı:

```text
STATUS:              PASS | FAIL | BLOCKED
FAILED CRITERIA:     <başarısız kriterler veya "None">
EVIDENCE:            <gözlenen test çıktısı, diff incelemesi, runtime kanıtı>
REQUIRED CORRECTION: <gereken en küçük somut düzeltme veya "None">
```

5. Harness'ın yerel rol ve araçlarını kullan (ayrıntılar: [references/harnesses.md](references/harnesses.md) ve [references/reviewer.md](references/reviewer.md)). Farklı model zorunlu değildir; mevcut rol yönlendirmesi yeterlidir.
6. Bağımsız review zorunlu olduğu halde reviewer aracı veya alt-agent desteklenmiyorsa: durumu BLOCKED veya PARTIAL olarak işaretle, eksik yeteneği ve insan incelemesi için temiz devir özetini sun. Asla bağımsız inceleme yapılmış gibi davranma.

## 4. Otomasyon ve Gerçek Çalışma Doğrulaması

1. İlgili otomatik testleri, tip kontrollerini ve lint kontrollerini bizzat çalıştır.
2. **Gerçek yüzey testi:** Testler tek başına uygulamanın çalıştığını kanıtlamaz; runtime, CLI veya UI akışını bizzat tetikle ve çıktıyı gözlemle.
3. **Geçersizlik ilkesi:** Kod değişince etkilenen kontrolleri ve review'u yenile; yalnızca HEAD hash'i yetersizdir, güncel dirty diff ve ilgili untracked içerik doğrulanmalıdır.
4. **PASS şartı:** Güncel kaynakta testlerin başarılı çalışması, (gerektiğinde) bağımsız reviewer onayı ve kabul kriterlerinin eksiksiz kanıtlanmasıdır.
5. Kanıtları projenin mevcut kayıtlarına (varsa takip kartına, gerektiğinde kısa bir `VERIFY.md` dosyasına) kaydet; küçük işlerde gereksiz dosya kalabalığı yaratma. Yeni makbuz şeması veya servisi kurma.

## 5. Sınırlı Tamir Döngüsü (Capped Repair)

1. Sadece somut kanıtı olan başarısızlıklara müdahale et; en dar alanda düzeltme yap. Bariz sınırlı hataları otonom çöz.
2. Etkilenen öz-kontrol, reviewer ve final doğrulama adımlarını yeniden çalıştır.
3. **Maksimum 2 tamir turu:** Bir görev için varsayılan tamir hakkı en fazla 2'dir. Süresiz döngüye girme.
4. İki turda çözülmeyen sorunlar, ürün/kapsam/maliyet kararı gerektiren durumlar veya eksik yeteneklerde hemen dur: kanıtı, kalan engeli ve bir sonraki tek aksiyonu kullanıcıya ilet.
5. Kullanıcı "dur" dediğinde hemen dur ve açıkta kalan durumu bildir.
6. Tüm adımlar PASS olduğunda çalışma incelemeye hazırdır; commit, push veya deploy için ayrı kullanıcı onayı gerekir.

Bu skill aktif oturumun iş akışıdır. Tek başına otomatik uyanma, zamanlayıcı veya atlanamaz runtime kapısı kurmaz. Global talimat değişikliğinin mevcut konuşmada yeniden yüklendiğini varsayma; yeni oturumda keşfi ve davranışı ayrıca doğrula.

## Referanslar

- Platform ve araç adaptasyonları: [references/harnesses.md](references/harnesses.md)
- Bağımsız reviewer sözleşmesi ve şablonu: [references/reviewer.md](references/reviewer.md)
- Çoklu worker ayrımı, yazma izolasyonu ve oturum detayları: [references/workstreams.md](references/workstreams.md)
