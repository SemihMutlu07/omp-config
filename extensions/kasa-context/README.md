# Kasa → OMP ana ve alt ajan bağlamı

Bu eklenti, yeni OMP oturumunda ve onun görev alt ajanlarında ilgili Kasa notlarını **otomatik** yükler. Bir README talimatı veya ajanın aramaya karar vermesi değildir. `context` olayı, modele giden her isteğe güncel, sınırlı kaynak verisi ekler.

## Sözleşme

- Kaynak: `~/Kasa`; `KASA_ROOT` veri kökünü değiştirir. Python kodu da bu kökteki `_vault/scripts/kasa-context.py` ve `kasa-index.py` dosyalarından çalışır.
- Mevcut SQLite FTS5/BM25 derleyicisi yeniden kullanılır. Her çağrıda kaynaklar kontrol edilir; ekleme, değişiklik, silme ve kapsamdan çıkma bir sonraki çağrıya yansır. Yeni timer, servis, embedding veya ek model çağrısı yoktur.
- Sorgudan en fazla **4 not**, başlangıç bölümünden açık oturum listesi ve günlük devir gelir. Toplam sınır ana oturumda **9.000**, alt ajanda **8.000 UTF-8 bayt**. Bu bir token sayısı değildir. Ana oturumda sorgu, son üç insan mesajındaki anlamlı sözcüklerden (en fazla 64) ve çalışma dizini adından gelir; ajan/MCP bildirimleri konu seçmez. Görev alt ajanında devredilen görev `role: user, attribution: agent` taşır ve arama girdisi kabul edilir; son üç kullanıcı-rolü mesajı kullanılır. Bu veri, yeni yetki veya politika sayılmaz. Eşleşmeme açıkça bildirilir.
- Her alıntıda göreli yol, satır, dosya değişiklik zamanı, dosyada belirtilen durum ve içerik özeti (SHA-256 öneki) bulunur. Not durumu, projenin güncel çalışma durumu olarak kabul edilmez.
- Alıntı, gerçek kullanıcı isteğinin **önüne**, `role: user`, `attribution: agent` veri mesajı olarak eklenir. Sistem/developer talimatına çevrilmez. Oturum geçmişine kaydedilmez; her çağrıda yeniden hazırlanır. Araç döngülerinde eski kopyalar birikmez.
- Gerçek OMP kimlikleri `kind: main` ve `kind: sub` biçimindedir. Görev alt ajanı `sub/task` arama yapar; `sub/advisor` otomatik aramadan dışlanır.
- Ana oturum yardımcıya `session_start: true` gönderir. Son tarihli günlük devir (`handoff/YYYY-MM-DD.md`) ve açık oturum listesi başlangıç bölümüne gelir. `README.md` veya görev özelindeki devir dosyası günlük devrin yerini alamaz. Görev notları normal sorguda bulunabilir. Toplam 9.000 B ile sınırlıdır. Sığmayan sorgu alıntıları atılır. Blok her çağrıda yeniden hazırlanır. Görev alt ajanları başlangıç bölümünü almaz. Bütün alıntılar tarihsel referanstır. Güncel talimat veya yetki sayılmaz.
- Açık oturum listesi başlangıç bölümünde günlük devirden önce gelir. Liste devir dosyasından değil, oturum dosyalarından türetilir: OMP (`~/.omp/agent/sessions`, `KASA_OMP_SESSIONS` ile değişir) ve Claude Code (`~/.claude/projects`, `KASA_CLAUDE_PROJECTS` ile değişir). Yalnız son 48 saatte değişen üst düzey dosyalar okunur. Alt ajan kayıtları sayılmaz. Son tam kapanış bloğunun `Sırada` değeri `yok`, `bitti`, `tamam` veya `tamamlandı` değilse oturum açıktır. Kural `kasa-handoff` kapısıyla aynıdır. Toplam sayı ve en yeni 5 oturum, `omp -r <kimlik>` veya `claude -r <kimlik>` komutuyla gösterilir. Liste en çok 1.000 B tutar. Gizli desenle eşleşen satır listeye girmez. Model çağrısı yoktur.
- Her oturum ayrı eklenti örneği ve son arama durumu tutar. Ana oturumun `/kasa-context` çıktısı, alt ajanların aramalarını topluca göstermez.
- Yardımcı süreç başarısızsa eski alıntı kullanılmaz. OMP devam eder, fakat modele **yüklenemedi** bilgisi gider; ana oturumun durum satırı da güncellenir.

## Veri kapsamı

Otomatik arama `domains/`, `projects/`, `thoughts/`, `handoff/`, `bookmarks/` ve `_vault/` içindeki Markdown notlarını kapsar. Gizli dizinler, symlink'ler ve herhangi bir seviyedeki `private`, `journal`, `people`, `secrets`, `credentials`, `sessions`, `archive`, `auto`, `inbox`, `context-packs` dizinleri hariçtir. Dizin adı karşılaştırması büyük/küçük harften bağımsızdır. `_vault/` kapsamı yalnız görev notlarıyla sınırlı değildir. İzinli bir kökte bulunmak, notu güncel karar veya yetki yapmaz.

Bir notun frontmatter’ına `context: false` koymak, onu otomatik bağlamdan çıkarır. `.kasa/policy.toml` içindeki mevcut `privacy.secret_patterns` eşleşirse **notun tamamı** çıkarılır. Politika eksik/bozuksa yükleme kapanır. Bu, bütün hassas metinleri tanıyan bir DLP sistemi değildir; özel metin için açık dışlama gerekir.

Arama yereldir; seçili OMP modeli yerel olmak zorunda değildir. Seçilen alıntılar normal model isteğinde mevcut sağlayıcıya gider ve normal bağlam maliyetine eklenir. `publish: false` web yayını sınırıdır; tek başına OMP bağlamından dışlama değildir. Bu eklenti uzak botlara dosya kopyalamaz, push yapmaz ve yayımlama izni vermez.

Türetilmiş indeks: `~/.cache/kasa/omp-context.sqlite` (dosya izni `0600`). `KASA_CONTEXT_DB` ile ayrı bir test indeksi kullanılabilir. Genel amaçlı `kasa-index.sqlite` ve eski pack akışı değişmez.

## Kurulum ve görünür kontrol

Kaynak dizin, mevcut eklenti yerleştirme düzeniyle bağlanır:

```bash
ln -s ~/dev/omp-config/extensions/kasa-context ~/.omp/agent/extensions/kasa-context
```

Bu komut mevcut hedefin üstüne yazmaz. `setup.sh` de bu dizini diğer eklentiler gibi kurar; yalnız bu değişiklik için tüm kurulumu çalıştırmak gerekmez.

**Yeni bir OMP oturumu** açılır. Açık oturumların yeniden yüklendiği varsayılmaz; diğer oturumlar yeniden başlatılmaz. Named profile’lara ve başka harness’lere kurulum yapılmaz. `--no-extensions` doğal olarak otomatik keşfi kapatır.

Ana terminalin alt satırı: `Kasa: ilk istekte taranır`, sonra kaynak sayısı/bayt, `eşleşme yok` veya `YÜKLENEMEDİ`. `/kasa-context`, çalıştırıldığı oturumun ajan kimliğini ve son çağrısının durumunu, kaynak yollarını, tazelik zamanını ve bayt sayısını gösterir; not gövdesini dökmez. Bu komutu kullanmak yüklemenin önkoşulu değildir.

Yerel yardımcıyı tek başına incelemek için:

```bash
printf '%s\n' '{"prompt":"omarchy resize border","cwd":"/tmp"}' | python3 -B ~/Kasa/_vault/scripts/kasa-context.py
```

Bu kontrol modele gitmez. Yardımcı çıktısı tek başına OMP entegrasyonunun kanıtı değildir.

## Kabul kapısı

1. Yeni, gerçek OMP sürecinde açık `-e` olmadan otomatik keşif görülür.
2. Gerçek sağlayıcı isteğinde bir kaynak veri bloğu bulunur; sistem/developer mesajında ham not yoktur.
3. Aynı oturumda not değiştirilince sonraki istek yeni değeri, silinince eşleşmeme sonucunu alır. Alıntılar geçmişe eklenmez veya birikmez.
4. Raw/private/symlink/secret/`context: false` kaynakları çıkmaz. Politika hatası eski bağlama geri dönmez.
5. Bağımsız inceleme, güncel kaynak üzerinde doğruluk ve gizlilik sınırlarını değerlendirir.

## Doğrulanan çalışma — 2026-10-29

Kasa otomasyon dizininde çalıştırıldı:

```bash
uv tool run --offline --from pytest pytest -q -o addopts= tests
```

Sonuç: **182 passed in 5.11s**. Yeni sekiz davranış testi; tazelik/silme, kapsam/gizlilik, politika hatası, bayt bütçesi, kaynak durumu/satırı, uzun istekte geç gelen konu ve `kasa`/`vault` sözcüklerini kapsar.

- **Gerçek varsayılan model, OMP 18.13.3:** yeni RPC sürecinde açık `-e` veya model seçimi olmadan yerel eklenti bulundu. Geçici Kasa notundaki rastgele kod, kod istemde bulunmadığı halde yanıta geldi. Not değişince yalnız `And now?` mesajı yeni kodu getirdi. Not silinince sonraki yanıt `UNKNOWN` oldu. Geçici koşu ayarında advisor/fallback kapatıldı; genel yapılandırma değiştirilmedi.
- **Sağlayıcıya giden mesajlar:** yalıtılmış yerel HTTP sağlayıcıyla gerçek OMP 18.13.3 RPC çalıştırıldı. Üç istekte kaynak bloğu sayısı `[1,1,1]`; geçmiş mesaj sayısı `6`. Alıntı sistem/developer mesajında yoktu. Kısa takip mesajı değişen kaynağı aldı; silinen kaynak sonraki istekte yoktu. OMP 18.13.1 ile de otomatik keşif ve bu mesaj sınırı çalıştırıldı.
- **O tarihteki gerçek task aracı/alt ajan:** OMP 18.13.3 ile ana/alt/ana/alt/ana sağlayıcı isteklerinde kaynak bloğu sayıları `[1,0,1,0,1]` idi; o sürümde alt ajana Kasa yüklenmiyordu. Bu tarihsel sonuç, aşağıdaki alt ajan desteği için kabul kanıtı değildir. Advisor ve `/tan` için ayrı etkileşimli koşu yapılmadı.
- **Gerçek terminal yüzeyi:** OMP 18.13.3 durum satırında `Kasa: 1 kaynak · 762 B`; `/kasa-context` çıktısında `status: ready`, kaynak yolu ve `refreshed_at` görüldü. Başlangıçta `not_yet_loaded` görüldü; dosya varlığından yükleme sonucu çıkarılmadı.
- **Bağımsız doğruluk:** `ContextCorrectness`, ilk incelemede FAIL; konu sözcükleri, 64 terim ve son üç insan mesajı düzeltmesinden sonra güncel kaynakta **PASS**. Gerekli düzeltme kalmadı.
- **Bağımsız gizlilik:** `ContextPrivacy` (`security-reviewer`), güncel kaynakta **PASS**, bulgu yok. İncelemeler salt okunur kaynak incelemeleridir; yukarıdaki komutların incelemecilerce tekrar çalıştırıldığı iddia edilmez.

Eşleşmeme, Kasa'da bilgi olmadığı anlamına gelmez. Sözcüksel arama yanlış sıralayabilir. FTS arama hatası `unavailable` olarak bildirilir; boş sonuçla aynı şey değildir. Ham oturumları özetleme, anlam tabanlı arama ve uzak bot senkronu bu bağlantının parçası değildir.

## Tüketiciler

Repo, Codex, Claude Code, ChatGPT ve uzak Grok botları için ayrım: [Kasa README](../../../../Kasa/README.md) (`~/Kasa/README.md`). Model adı dosya keşfini belirlemez; harness belirler. Diğer tüketicilere gerçek bağlantı bu değişiklikle kurulmaz.

## OMP kaynakları

- [v18.13.1 context olayı](https://github.com/can1357/oh-my-pi/blob/v18.13.1/packages/coding-agent/src/extensibility/shared-events.ts)
- [v18.13.1 mesaj dönüşümü](https://github.com/can1357/oh-my-pi/blob/v18.13.1/packages/agent/src/compaction/messages.ts)
- Kurulu OMP belgeleri: `omp://extension-loading.md`, `omp://models.md`, `omp://rpc.md`.

## Önceki canlı vault ölçümü

Önceki yerel ölçümde gerçek `~/Kasa` üzerinde yardımcı çalıştırıldı: `status: ready`, indekslenen **838 not**, dönen **4 kaynak / 5.280 bayt**, süre **1,646 saniye**. Bu tek çağrı ölçümüdür; performans garantisi veya sonuçların konu açısından doğru sıralandığının kanıtı değildir. Geniş bir Kasa/bağlam sorgusu eski ve dolaylı notları üste getirebildi. Dolayısıyla “otomatik kaynak yüklendi” ile “Kasa'daki bütün kararlar doğru hatırlandı” aynı iddia değildir.

## Güncel kabul — OMP 18.14.0

- Yeni OMP süreci gerçek `task` aracını çağırdı; çocuk kimliği `kind: sub`, `name: task`, `id: KasaFinalProbe`, `depth: 1` idi. Kasa eklentisi yerel keşifle yüklendi; açık `-e` yalnız geçici ölçüm eklentisini ekledi. Model, sağlayıcı, kimlik bilgileri ve genel yapılandırma değiştirilmedi.
- Önceki filtre gerçek görev mesajını (`role: user, attribution: agent`) dışlayıp aramayı atlıyordu. Regresyon bu durumda düzeltmeden önce başarısız oldu. Düzeltilmiş filtre alt ajan görevini kabul eder; ana oturumdaki ajan bildirimini ve `sub/advisor` otomatik aramasını dışlamayı sürdürür.
- Çocuğun gerçek sağlayıcı isteğinde on `RULES.md` paragrafı `payload.instructions` sistem alanında bulundu. Tek Kasa kaynak bloğu `payload.input[0].content[0].text` içinde `role: user` taşıdı; `_vault/tasks/T78.md` dâhil dört kaynak içerdi. Kasa bloğu sistem/developer alanında bulunmadı. Sağlayıcı HTTP **200** döndürünce yalnız bu deneme süreci durduruldu; yanıt üretiminin tamamlandığı iddia edilmez.
- İlk denemedeki yalnız “Kasa reference data” metin eşleşmesi kabul kanıtı değildir; görev metni de bu ifadeyi taşıyabiliyordu. Son kabul, kaynak yollarını ve mesaj rolünü de zorunlu tuttu. Gövde veya kimlik bilgisi içermeyen yerel kayıt: `/tmp/kasa-live-acceptance-6xxnubu9/receipt.json`; başarısız ve başarılı denemelerin üstverisi: aynı dizindeki `verified-requests.jsonl`.
- Çalıştırılan kontroller: `bun test ./extensions/kasa-context/test-kasa-context.ts` → **3 geçti**; `python3 tests/test_agents_neutrality.py` → **16 geçti**; Kasa kökünde `uv tool run --offline --from pytest pytest -q -o addopts= automation/tests/test_kasa_context.py` → **11 geçti**. Bun derlemesi başarılıdır; bu bir TypeScript tür kontrolü iddiası değildir.
- Bağımsız `KasaBoundaryReview` incelemesi güncel kaynak için **PASS**, başarısız kriter ve gerekli düzeltme yok sonucunu döndürdü. Bu kaynak incelemesidir; canlı sağlayıcı kanıtı ayrı olarak yukarıdaki denemeden gelir.

## Karar dizininin kaldırılması — 2026-11-13

`KARARLAR.md` ve `KARAR-KUYRUGU.md` artık başlangıç veya sorgu kaynağı değildir. Karar satırı ayıklama, özel sıralama ve karar kuyruğu bildirimi kaldırıldı. Kaynak notları ve oturum arşivi korunur. Aşağıdaki karar-yükleme testleri eski davranışın tarihsel kaydıdır. Güncel kabul koşulu değildir.

Günlük handoff ve sorgu eşleşmesi bulunmasa da açık oturum listesi başlangıç bağlamında korunur. Kaynak yolu sayısının sıfır olması, dolu başlangıç bağlamını `no_match` yapmaz.

## Karar ve devam regresyonu — 2026-11-07

- Üç yeni davranış testi düzeltmeden önce başarısız oldu: uzun defterdeki ilgili iptalin özette kaybolması, 35 eski planın güncel kararı FTS sınırından düşürmesi ve `README.md` dosyasının günlük devir yerine seçilmesi.
- Kasa kökünde `env PYTHONPATH=automation uv tool run --offline --from pytest pytest -q -o addopts= automation/tests` → **221 passed**; yalnız bağlam dosyası → **26 passed**. OMP-config kökünde `bun test ./extensions/kasa-context/test-kasa-context.ts` → **4 pass**. İstek bayrağını yankılayan wiring-only test kaldırıldı; gerçek davranış regresyonları Kasa testlerindedir.
- Gerçek yeni OMP 18.16.0 süreci, açık `-e` ve model seçimi olmadan çalıştı: `omp -p --no-session --no-tools --no-title --max-time 90s --cwd /tmp '…'`. İstemde karar veya devir içeriği verilmeden Movies Wrapped için ürün adımı olmadığını, K-20261107-02 iptalini, son bağlam düzeltmesini ve o anda kalan iki kontrolü doğru kaynaklarla bildirdi; exit 0. Testleri kendisi çalıştırmadığını ve devir özetinin kesik olduğunu da ayırdı.
- Bu, bu laptopta otomatik bağlamın gerçek model yanıtında kullanıldığının kanıtıdır. Sağlayıcı ağ gövdesi bu koşuda kaydedilmedi; uzak ajanlar, bütün eski konuşmaların hatırlanması veya gelecekteki her işin kendiliğinden doğru tamamlanması doğrulanmış sayılmaz. Yeni servis, timer veya model yönlendirmesi eklenmedi.
- Bağımsız `MemoryLoopReview` ilk kaynak incelemesinde **FAIL** verdi: konu seçimi genel kararları düşürüyordu ve tek karar kaydı geçmiş konuşma aramasını engelliyordu. İki ek regresyon önce başarısız oldu; tamir 1 sonrası aynı tam-suite komutu → **223 passed in 3.77s**. Güncel yardımcı SHA-256: `0bf90d069bf7eeebfe5e763df983cea1562212e5e0a3ed16741fefc0d92d625a`; test dosyası: `846c738b571b6fb83d5cc1f2129bec8a024cc4d0ef580d0a9ebe4b9cf4172313`. Önceki 221/26 sonucu tamirden önceki koşudur.
- Ayrı `python3 scripts/install-gauntlet-loop.py --check` denetimi **exit 1**: yalnız `~/.cursor/rules/global.mdc` uyumsuz; `changed: []`. OMP'nin yönetilen doğrulama bloğu uyuştu. Cursor kuralı bu OMP/Kasa düzeltmesinde değiştirilmedi.
- Bağımsız yeniden inceleme `MemoryLoopRecheck` **PASS**: F1/F2 giderildi, zorunlu bulgu yok. Bu kaynak incelemesidir; incelemeci komut/test çalıştırmadı.
- Onarım sonrası aşağıdaki gerçek yeni OMP 18.16.0 koşusu **exit 0**, **20,12 sn**: son bağlam düzeltmesi, Movies Wrapped iptali, 7–21 Kasım meta dondurması, 223/4 test kaydı ve incelemenin kaynak/test ayrımı doğru yanıtlandı. İstemde bu cevaplar verilmedi.

```bash
omp -p --no-session --no-tools --no-title --max-time 90s --cwd /home/semihmutlu/Kasa 'Salt okunur devam kontrolü: napıyorduk? Yalnız otomatik gelen Kasa bağlamından en son işi, geri dönülmeyecek projeyi ve genel çalışma sınırını söyle. Yapılmış kontrol ile kalan adımı ayır. En çok 5 satır, kaynaklarıyla. Araç kullanma, yeni iş veya sistem önermeye başlama; bağlamda olmayanı uydurma.'
```

- Sonuç, yeni kart açılmadan mevcut Notion `4034b6f5-8b3b-81a9-9fa9-e9c194cfd8b4` kartına yazıldı. Taze `fetch`: bu koşunun sonuç bölümü **1**, `Durum: Sürüyor`, güncel test ve inceleme kaydı mevcut. Bu tek yazma gösterimidir; genel otomatik tekrar önleme kanıtı değildir. Kalıcı devam: `~/Kasa/handoff/2026-11-07.md`, “Güncel devam”.
