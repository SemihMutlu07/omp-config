---
name: gauntlet-loop
description: |
  Mevcut ve somut bir implementasyon/tasarım/feature/artifact'ı ciddi refinement +
  bağımsız doğrulama döngüsünden geçirir: sabit acceptance contract → worker'lar
  iyileştirir → bağımsız verifier'lar kanıtla denetler → lokal tamir → entegre →
  final sistem doğrulaması. Use when the user says "/gauntlet-loop" or a concrete
  existing artifact needs a serious refinement and verification pass ("bunu cilala",
  "refine et", "quality pass yap", "bir tur daha iyileştir"). NOT the default
  starting workflow: SHORT işte normalde kullanılmaz, MESSY işte önce excavation
  gelir, ürün yönü net değilse dur.
---

# gauntlet-loop

Mevcut ve somut bir hedef üzerinde ciddi refinement + bağımsız doğrulama döngüsü.
Ne inşa edileceğini keşfetmek için kullanılmaz — bilinen bir yönü iyileştirir, icat etmez.

## Entry gate

Görevi önce kanonik task sınıflarıyla sınıflandır: **SHORT**, **LONG**, **MESSY**.

- **SHORT:** normalde Gauntlet kullanma. Yalnızca değişiklik yüksek riskli veya
  kaliteye duyarlıysa kullan.
- **LONG:** hedef ve plan netleştikten sonra Gauntlet çalışabilir.
- **MESSY:** önce excavation şart. `STATE.md`'yi oku, Gauntlet başlamadan önce
  sınırlı bir plan kur.

Ürün yönü, gereksinimler veya mimari hâlâ belirsizse dur ve önce onları çöz.

## Goal

Somut bir hedef al ve:

- sabit bir acceptance contract kur
- sadece gerçekten bağımsız işleri böl
- sınırlı workstream'leri implement et
- onları bağımsız doğrula
- başarısızlıkları lokal tamir et
- entegre et
- final sistem seviyesi doğrulama yap

Acceptance contract geçince veya tanımlı bir engel ilerlemeyi bloke edince dur.

## Capacity preflight

- Oturumları yalnızca orchestrator açar veya kapatır.
- Herhangi bir worker/verifier açmadan önce: `herdr_agent list` → global çalışan
  agent limitine (≤8 working) saygı göster.
- Paralelliği artırmak için agent uydurma.

Worker'lar ve verifier'lar:

- alt-agent açmaz
- model/effort ayarı değiştirmez
- push/deploy/publish yapmaz
- entegrasyon sahibi olarak açıkça atanmadıkça merge yapmaz

Tercih edilen yapı:

```
orchestrator
+ N bağımsız worker
+ 1 verifier
<= global working-agent limit
```

Bir verifier birden çok workstream'i sırayla doğrulayabilir; worker başına bir
verifier gerekmez.

## Step 1 — Acceptance contract

Implementasyondan önce kısa bir acceptance contract'ı dondur:

- **Target** — iyileştirilecek kesin sonuç nedir?
- **Must preserve** — hangi mevcut davranış, ürün kararı, API, görsel dil veya
  mimari değişmemeli?
- **Hard criteria** — geçmesi zorunlu ikili gereksinimler. Örnek: build başarılı,
  320–430px'te yatay taşma yok, modal arka plan scroll'unu kilitliyor, navigasyon
  beklenen route'a ulaşıyor, mevcut API contract'ı değişmiyor.
- **Soft criteria** — yargı gerektiren kalite boyutları. Örnek: görsel hiyerarşi,
  algılanan cilalama, okunabilirlik, motion kalitesi, maintainability. Soft
  criteria sessizce yeni ürün gereksinimine dönüşmemeli.
- **Evidence** — her hard criterion için nasıl kontrol edileceği. Tercih: test,
  build/typecheck/lint, browser inspection, screenshot, benchmark çıktısı,
  file/diff inceleme, runtime log. Kaçın: "Doğru görünüyor."
- **Stop condition** — worker'lar başlamadan önce neyin tamamlanma sayılacağını
  tanımla.

Acceptance contract'ın sahibi orchestrator'dır; worker'lar onu yeniden tanımlayamaz.

## Step 2 — Decompose

Hedefi en küçük yararlı workstream'lere böl. Yalnızca güvenle bağımsız ilerleyen
işleri paralelleştir.

İyi örnekler: responsive layout, modal etkileşim davranışı, performans darboğazı,
erişilebilirlik düzeltmeleri.

Kötü decomposition: frontend agent / senior frontend agent / UI expert agent /
polish agent — farklı başlıklar bağımsız workstream değildir.

**Write isolation:** iki paralel worker aynı worktree'yi değiştirmemeli. Paralel
implementasyon örtüşen dosyalara dokunabilirse: ayrı branch/worktree kullan veya
işi sıraya al. Aynı working tree'ye eşzamanlı yazmaya izin verilmez.

## Step 3 — Delegate workers

Her worker prompt'u kanonik dört bloklu contract'ı kullanır:

```text
OUTCOME: <tek somut sonuç>
SOURCE: <kesin worktree, branch, dosyalar, STATE.md / PLAN.md bölümü, referans veya artifact>
CONSTRAINT: <kapsam sınırları> + must-preserve davranış + alakasız refactor yok +
yeni dependency yok (gerektirmedikçe) + alt-agent açma + model/effort değiştirme +
push/deploy/publish yok + acceptance criteria'yı yeniden tanımlama
CHECK: <en dar ilgili doğrulama> + beklenen başarı koşulu + mümkünse ham kanıt
```

Feature işlerinde AGENTS.md LOC bütçesi geçerli: worker mesajlarına
`BÜTÇE: Bu feature en fazla 1500 satır diff ... Her mesaj sonunda "LOC: +x/1500"` eklenir.

Worker'lar somut değişiklik yapar; workstream açıkça analiz gerektirmedikçe sadece
öneri üretmez. Worker'ın "görev tamam" demesi kanıt değildir.

## Step 4 — Worker verification

Bağımsız verifier'a teslim etmeden önce her worker kendi CHECK'ini çalıştırır.
Worker çıktısı şunları içermelidir:

```text
RESULT:      ne değişti
CHECK:       çalıştırılan kesin kontroller
EVIDENCE:    ilgili ham çıktı, screenshot yolu, diff, test sonucu veya artifact
KNOWN ISSUES: kanıtlanmayan her şey
```

Self-verification bariz hataları yakalar; bağımsız doğrulamanın yerine geçmez.

## Step 5 — Independent verifier

Kontrol edilen işi implement etmemiş bir verifier kullan. Verifier şunları alır:

- **OUTCOME** — <workstream veya entegre hedefi> dondurulmuş acceptance
  contract'a karşı doğrula.
- **SOURCE** — kesin branch/worktree/artifact, orijinal acceptance contract,
  ilgili implementation diff'i.
- **CONSTRAINT** — sadece oku ve test et (tamir atanmadıkça), worker iddialarına
  güvenme, alt-agent açma, acceptance criteria'yı değiştirme, model/effort
  değiştirme, push/deploy/publish yok.
- **CHECK** — acceptance kontrollerini bağımsız çalıştır; gerçek artifact'i ve
  kanıtı incele.

Verifier çıktısı zorunlu:

```text
STATUS:             PASS | FAIL | BLOCKED
FAILED CRITERIA:    başarısız kesin acceptance kriterleri
EVIDENCE:           gerçekte gözlenen kanıt
REQUIRED CORRECTION: gereken en küçük somut düzeltme
```

- **PASS** kanıt gerektirir.
- **BLOCKED** = gereken kontrol şu an yapılamıyor veya bir karar eksik.
- BLOCKED'ı PASS'e çevirme.

## Step 6 — Repair loop

Her `FAIL` için:

1. yalnızca başarısız kriterleri ve verifier kanıtını ilgili worker'a geri gönder
2. en küçük başarısız alanı tamir et
3. worker'ın CHECK'ini yeniden çalıştır
4. sonucu bağımsız doğrulamaya geri gönder

Tamirleri lokal tut; tamir onları etkilemiyorsa geçen alanları yeniden açma.

**Loop limit — varsayılan maksimum: workstream başına 2 tamir turu.** İki başarısız
tamir turundan sonra lokal döngüyü durdur, engeli veya tekrarlayan başarısızlığı
tanımla ve orchestrator'a yükselt. Orchestrator şunlara karar verir: planı değiştir,
daha derin incele, görevi MESSY'ye geri yükselt, Semih'e ürün/mimari kararı sor,
veya PARTIAL olarak bitir. Süresiz iterate etme.

## Step 7 — Integrate

İlgili workstream'ler bağımsız doğrulamadan geçtikten SONRA:

- onaylanan değişiklikleri entegre et
- çakışmaları çöz
- birleşik diff'i incele
- proje seviyesi kontrolleri yeniden çalıştır

Entegrasyonun sahibi orchestrator'dır (başka bir sahip açıkça atanmadıkça).
Worker'lar push/deploy yapmaz. Workstream'lerin tek tek geçmesi entegre sonucun
çalıştığını kanıtlamaz.

## Step 8 — Final verification

Entegrasyondan sonra, orijinal acceptance contract'a karşı bağımsız bir verifier
kullan. Kapasite uygunsa taze bir verifier oturumu tercih et. Final verifier
worker özetlerini değil tam artifact'i inceler:

- her hard criterion
- workstream'ler arası etkileşim
- regresyonlar
- preservation gereksinimleri
- ilgili soft criteria

Final sonuç:

- **PASS** — tüm hard criteria kanıtla geçti.
- **PARTIAL** — yararlı iyileştirme var ama bir veya daha çok kriter bloke veya
  başarısız.
- **FAIL** — istenen hedef acceptance contract'ı karşılamıyor.

Sübjektif bir soft criterion tek başına sonsuz tamir turu yaratmamalı. Tek opsiyonel
polish turu şu durumlarda kullanılabilir: tüm hard criteria zaten geçiyor, iyileştirme
somut, değişiklik düşük riskli. Aksi halde dur.

## Evidence record

LONG ve MESSY işler için `VERIFY.md`'yi güncelle; kısa tut. Büyük ham logları
kalıcı artifact'lere kopyalama — özet sonuç + yol/referans yeterli.

```markdown
# Verification

## Target
Mobile results page refinement.

## Hard criteria

- [x] No horizontal overflow at 320px
  Evidence: browser check + screenshot path

- [x] Modal locks document scroll
  Evidence: browser interaction test

- [x] Production build succeeds
  Evidence: `npm run build` exit 0

- [ ] Results navigation under slow network
  Evidence: timeout reproduced
  Status: BLOCKED

## Final status

PARTIAL
```

## Session lifecycle

Her Gauntlet oturumunun tek bir amacı vardır. Örnek: `worker-mobile-layout`,
`worker-modal-scroll`, `verify-results-page`, `final-review-results-page`.

Oturumun amacı tamamlanıp kanıt diske kaydedildiğinde, onu AÇAN agent global oturum
sahipliği kurallarına göre kapatır (orchestrator kendi açtığını kapatır; Semih'in
açtığı pane'e dokunulmaz). Olası gelecek iş için bitmiş worker'ları canlı tutma;
sonraki iş gerekiyorsa yeni oturum aç ve disk/Git kanıtından başla.

## Model and harness policy

- Gauntlet model seçmez; agent'lar model/effort ayarı değiştirmez. Semih'in seçtiği
  model routing'i kullanılır.
- Pi/Herdr interactive coding orkestrasyon ortamıdır; Hermes normal Gauntlet kodlama
  döngüsünün parçası değildir. Hermes yalnızca mevcut Hermes politikasının açıkça
  atadığı yerlerde kullanılır (doğrulanmış browser otomasyonu, cron, bildirim).

## Output

Dön:

**Result** — ne değişti.
**Verification** — gerçekte ne kontrol edildi ve önemli kanıt.
**Remaining issues** — başarısız, bloke veya kanıtlanmamış kriterler.
**Gauntlet** — Task class, Workers, Verifier rounds, Repair rounds, Final status:
`PASS | PARTIAL | FAIL`.

## Core rules

- Kanıt, agent güveninden üstündür.
- Oturum başına tek ana amaç.
- Delegasyonun tek sahibi orchestrator.
- Worker'lar worker yaratmaz.
- Verifier'lar implementasyon iddialarına güvenmez.
- Worker'lar acceptance criteria'yı yeniden tanımlayamaz.
- Paralellik gerçek bağımsızlık gerektirir.
- Aynı worktree'ye asla eşzamanlı yazma.
- Tamir döngüleri lokal kalır.
- Kapsam sessizce genişletilmez.
- İyileştirirken ürün yeniden tasarlanmaz.
- Açık ihtiyaç olmadan dependency eklenmez.
- Açıkça yetkilendirilmedikçe push/deploy/publish/dış aksiyon yok.
- Hard criteria mümkün olduğunca deterministik geçmeli.
- Soft criteria yargı ister ama sonsuz cilalama yaratmamalı.
- Kanıt tamamlanmayı ispatlayamıyorsa belirsizliği raporla.
- `done` kanıt değildir.

## Workflow ayrımı

```
SHORT    implement → check
LONG     inspect → plan/artifact → implement → verify
                        └→ gauntlet if quality/risk warrants it
MESSY    excavate → STATE.md → bounded plan
                        └→ LONG / gauntlet
GAUNTLET known target → workers → independent verify → local repair
        → integrate → final verify
```

## Altyapı (herdr)

- `herdr_layout` → `pane_split` (caller tab + cwd), dönen `pane_id`'yi oku;
  oturum adı görevi yansıtır (`worker-mobile-layout`, `verify-results-page` gibi).
- `herdr_agent start` (tekil `name`, `kind`, `pane`) → `prompt` + `wait` (timeout
  ver; settlement bekle, polling yok; `blocked` dönerse incele, `unknown` = belirsiz).
- `read` → `source: recent-unwrapped`, `lines` artır; tam ekran kesilirse agent'tan
  sonucu repo DIŞI yola (`/tmp/...`) yazmasını iste, dosyayı oku (repoya yazdırma).
- Topoloji: space ≤10, tab ≤10/space, pane ≤6/tab; çalışan agent ≤8 (global).
  Detay: `delegate-wave` skill'i.
