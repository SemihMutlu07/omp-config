# Bağımsız İnceleme (Independent Reviewer)

Bağımsız reviewer, yapılan değişikliği bizzat yazmamış olan ve sadece doğrulamadan sorumlu inceleme rolüdür. Amacı yazarın iddialarını onaylamak değil; acceptance contract'ı güncel kod ve çalışma kanıtıyla tarafsız denetlemektir.

## Temel Kurallar

1. **Yazma Yetkisi Yoktur:** Reviewer salt-okuma ve test çalıştırma yetkisine sahiptir. Kod yazmaz, dosya düzenlemez veya otomatik commit atmaz.
2. **Kriterleri Değiştiremez:** Orijinal acceptance contract sabittir; kriterleri hafifleterek veya yeniden tanımlayarak `PASS` veremez.
3. **Alt-Agent Açamaz:** Reviewer kendi altında başka alt-agent'lar başlatmaz.
4. **Yazar Savunması Verilmez:** Reviewer'a yazarın çıkarımları, niyet açıklamaları veya "şöyle çözdüm" iddiaları yerine yalnızca ham veriler verilir.

## Reviewer Girdileri

Reviewer çağrılırken şu girdiler sağlanır:

```text
ORIGINAL SPEC:    Ulaşılacak hedef, kapsam sınırları ve dondurulmuş kabul kriterleri
CHECKOUT STATUS:  Mevcut git commit hash'i, dirty diff (`git diff`) ve untracked dosyalar
TEST COMMANDS:    Çalıştırılması beklenen kesin kontrol komutları
RUN ENVIRONMENT:  Varsa canlı yüzey (CLI, port, browser) erişim bilgisi
```

## Reviewer Çıktı Şablonu

Reviewer her inceleme sonunda kesinlikle şu şablona sadık kalmalıdır:

```text
STATUS:              PASS | FAIL | BLOCKED
REVIEWER:            <gerçek reviewer oturum/task kimliği ve alınan sonuç referansı>
FAILED CRITERIA:     <başarısız olan kriterlerin tam listesi veya "None">
EVIDENCE:            <çalıştırılan komutlar, terminal çıktıları, diff ve gözlemler>
REQUIRED CORRECTION: <başarısızlığı giderecek en küçük somut müdahale veya "None">
```

### Durum Kodları

- **PASS:** Tüm hard criteria ve acceptance maddeleri güncel kaynak kod üzerinde gerçek komut ve çalışma çıktılarıyla kanıtlandı.
- **FAIL:** Bir veya daha fazla kriter başarısız oldu. Gözlenen hata ve düzeltme önerisi somut olarak belirtilir.
- **BLOCKED:** Gerekli bir ortam bağımlılığı, eksik yetenek veya yanıtlanmamış ürün kararı nedeniyle kontrol yapılamıyor.

## Bağımsız Reviewer Bulunmadığında Davranış (Fallback)

Harness bağımsız bir reviewer oturumu / alt-agent'ı çalıştıramıyorsa:

1. Asla yazarın self-check çıktısını "bağımsız reviewer onayladı" olarak raporlama.
2. Durumu `BLOCKED` veya `PARTIAL` olarak kaydet.
3. Eksik yeteneği açıkça belirt (örn: "Harness ortamında bağımsız subagent aracı bulunmuyor").
4. Kullanıcıya temiz bir insan devri (Manual Review Handoff) sun:
   - İncelenecek dosyalar ve güncel diff özeti.
   - Doğrulama için bizzat çalıştırılacak test/çalışma komutları.
   - Gözlemlenmesi gereken beklenen davranış.
