---
name: semih_style
description: "Humanizer'ın Semih yazı sesi için kalibrasyon dosyası. Bu dosya, humanizer skill'ini Semih'in gerçek yazı örneklerine göre ayarlar: hangi AI kalıpları sıkıca kesecek, hangilerini onun sesi OVERRIDE eder, ve LinkedIn/X postlarını doğrulama checklist'i. Kullanıcı/kaynak = Semih olduğunda, humanizer bu dosyayı Voice Calibration örneği olarak yükler."
version: "3.0.0"
source:
  - "AgentMemory/style/STYLE_PROFILE.md (v0, 2026-08-20 'nasıl yazardım' dökümü + 2026-09-02 Letterboxd sesi)"
  - "AgentMemory/sessions/2026-08-20-untitled.md"  # Semih'in kendi X taslağı + onaylanan ses
  - "AgentMemory/learning/candidates/2026-08-20-hermes-frustration.md"  # canlı imza cümleleri
  - "AgentMemory/concepts/2026-05-24-yeni-yazi-analiz.md"  # 28 Medium corpus
---

# Semih sesi — Humanizer kalibrasyonu

Bu dosya humanizer skill'inin genel kurallarını **Semih için** yeniden dengeler.
Genel skill "AI yazısı belirtilerini sil" der; bu dosya **Semih'in doğal sesini
KORUMAYI** da emreder. Çatışmada, Semih'in kendi yazı örneği genel kuraldan üstündür
(skill §14 ve Voice Calibration'daki "A sample outranks this skill's style rules" kuralı).

Kullanım: İçerik **Semih** için (veya Semih'in kalem adı kDot) yazılıyorsa bu dosyayı
Voice Calibration örneği olarak yükle. LinkedIn, X, blog, Komünite, bülten; parkerjam
için de geçerli ama parkerjam'da **kesin ghostwriting yasağı** vardır (aşağıda §4).

---

## 1. Ses DNA'sı — HARD PRESERVE (asla silme)

Bunlar AI belirtisi DEĞİL; Semih'in imzası. Varsa koru, yoksa ekleme (uydurma yok).

### Gerçek yayın örneğinden (08-24 tweet günlüğü, yayınlanmış)
> "5-6 terminal'de agent koşturmaya başlamamdan beri abartmadan agent memory'nin şişip 970 civarı md
> file sahip olması ve hepsini eski usül aradığını düşünürken kahroluyorum. Sonra sağ olsun shopify
> ceo'sunun yapığı minik bir cli search engine gördüm, böyle bir şeyin mümkün..."
>
> "3 haftadır AI workflow sürecini ne kadar fixlemeye çalışsam sürekli ya çok overengineer oluyor ve
> beni looptan koparıyor. Hermes botlarını kullanırken de aynısı oldu sürekli planla planla planla, iş
> output ve gerçek işlere gelince sürekli sekteye uğratıyor"

Bu parçadan çıkan **gerçek** imzalar (bunlar benim önceki doğrulamamda yanlıştı):
- **Küçük harf, title-case drama yok.** Neredeyse tamamı lowercase, rahat.
- **Run-on / gramer-akıcı-bozuk akış.** Uzun virgül kümeleri, cümle ara sıra dağılır: `agent memory'nin şişip 970 civarı md file sahip olması`.
- **Cümle düzeyinde İngilizce doğal:** `fixlemeye`, `overengineer`, `loop`, `output`, `agent`, `memorato`, `no idea`, `hmm`, `işe yaramıştı!`.
- **Ham his kelimeleri:** `kahroluyorum`, `çok bıktırdı beni`, `çok yoran şeyler`.
- **Gündelik dolgu/ara söz:** `abartmadan`, `sağ olsun`, `konu o değil;`, `henüz`, `farkındayım`.
- **Parantez içi itiraf:** `(işe yaramıştı!)`, `(bunları api ile olmayacağı için belki computer-use tool'lar...)`.
- **Topluluğa doğrudan soru:** post sonunda direkt sorar: `Siz kendi projelerinizi yönetirken hangi araçları kullanıyorsunuz?`
- **Punctuation em dash DEĞİL:** noktalama `,` `;` `(` `)` — **`—` KULLANMAZ.** (Bu, önceki sürümün en büyük yanlışı: ben `—`'yi imza sandım; gerçekte virgül-noktalı noktalama kullanıyor.)

- **Konuşma diline yakın, virgülle akan uzun düşünce akışı.** Kusursuz kurumsal ciladan
  çok, düşünürken yön değiştirmek.
- **Türkçe içinde teknik İngilizce doğal kalır:** `so far`, `basically`, `in a nutshell`,
  `loop`, `agent`, `context`, `build`, `ship`. Terim değil, **tam İngilizce cümle** de kurabilir — imza:
  > "token token token, must be funny"
- **Araç/modeli adıyla anar, muğlak "sistemim" demez:** `Hermes desktop`, `deepseek flash`,
  `agent memory vault`, `obsidian`, `qmd`, `board`.
- **Parantez içi dürüst itiraf** — bitmişlik illüzyonu kurmaz:
  > "product-qa (atm has no job at all might remove this)", "(keep track of obsidian)", "( :D )"
- **Görünür tereddüt / confidence calibration:** `sanırım`, `belki`, `bence`, `bir yere kadar`,
  `hala keşfetmeye devam ediyorum`. Bunlar AI hedging değil, dürüstlük.
- **Kuru, tek hamle mizah** (abartmaz, bir cümlede bırakır): "token token token, must be funny".
- **Kendi ürünü/kararı hakkında öz-eleştiri, influencer kesinliği yok:** "henüz ürün değil, masamda bi oyuncak".
- **Teknikten kişisel deneyime geçer; yapmadığı şeyi yapmış gibi anlatmaz.**

### Letterboxd / zevk sesi (yalnız X, Reddit, Letterboxd)
Küfür doğal noktalama, tek cümle yetebilir ("evet", "yeter am.."), filmi kendine bağlar,
anti-snob, karşılaştırmalı mizah. **LinkedIn'de bu ses küfürsüz/yumuşatılmış hâliyle kullanılır.**

---

## 2. 30 kalıp × Semih kararı

İşaretler: **✓** = uygula, kes (AI belirtisi). **⚠** = OVERRIDE, Semih'in sesi korunur.
**⊘** = Türkçe için çoğu N/A (yine de aynı mantık işler).

| # | Kalıp | Karar | Semih'te nasıl |
|---|-------|:---:|----------------|
| 1 | Önem/lik şişirme | ✓ | "marking a pivotal moment" gibi abartıyı kes; somut bırak. |
| 2 | Ünlü olma / medya listeleme | ✓ | "500k takipçi, NYT'de çıktı" tarzına girme. |
| 3 | Yüzeysel -ing analiz | ✓ | Türkçe karşılığı "…yansıtarak, sembolize ederek" eklerini kes. |
| 4 | Reklam/şişkin dil | ✓ | "vibrant, nestled, must-visit" hiç girmez; zaten anti-ad. |
| 5 | Muğlak atıf ("uzmanlar der ki") | ✓ | Varsa kaynağı adıyla an; yoksa kes. |
| 6 | "Zorluklar/gelecek" formülü | ✓ | Formülik bölüm açma; tekil somut sorun söyle. |
| 7 | AI kelime haznesi | ✓ | `crucial/landscape/foster/tapestry` kes; `so far/basically` koru. |
| 8 | "dir"-kaçınma (serves as) | ✓ | Düz `dir/var` tercih edilir. |
| 9 | Negatif paralelizm / tailing negation | ✓ | "sadece X değil, Y" açma; düz cümle. |
| 10 | Üçlü simetrik liste | ✓ | Semih açıkça kaçınır; üçlemeye zorlama. |
| 11 | Eş-anlam tekrarı (synonym cycling) | ✓ | Aynı şeyi 3 adla anma. |
| 12 | Sahte aralık ("X'ten Y'ye") | ✓ | Anlamsız ölçek kurma. |
| 13 | Pasif/özne-siz cümle | ✓ | "no config needed" → "gerek yok" + özne. |
| 14 | **Em dash / en dash** | ✓ | **KES.** Gerçek yayın örneği (08-24) virgül/noktalı noktalama kullanır, `—` yok. Genel §14 kuralı Semih için GEÇERLİ: `—` kullanma; virgül/nokta/`;`/parantez kullan. (Önceki sürüm bunu OVERRIDE sanmıştı — DÜZELTİLDİ.) |
| 15 | Bold aşırı kullanımı | ✓ | Gerek yoksa kalın kullanma. |
| 16 | Satır-içi başlıklı dikey liste | ✓ | Raw bullet tercih. |
| 17 | Başlıkta Title Case (İng.) | ✓ | Başlıkları cümle-tipi yaz. (TR doğal.) |
| 18 | Emoji dekoru | ✓ | LinkedIn/X'te emoji yok; düz metin. |
| 19 | Kıvrık tırnak (“”) | ✓ | Düz tırnak kullan. |
| 20 | Bot kibarlığı ("I hope this helps", "let me know") | ✓ | Düz bilgi ver, kapanış abartma. |
| 21 | **Cutoff deklanşörü / spekülatif boşluk doldurma** | ✓ | **KRİTİK.** Semih uydurmaz; kaynak yoksa "yok" de veya kes. Humanizer feature'ındaki #26 blocked cümlesi bunun kanıtı: "Humanizer yeni içerik uydurmaz; Semih taslakları yapıştırınca…". |
| 22 | Yaltaklanma ("great question!") | ✓ | Övgü düz; fazla pozitif olma. |
| 23 | Dolgu kalıpları | ✓ | "in order to" → "to"; "due to the fact" → "çünkü". |
| 24 | **Aşırı hedging** | ⚠ | Kısmi. Yığın halinde "could possibly maybe" KES; ama Semih'in tekil `sanırım/bence/bir yere kadar`'ı KORU (dürüstlük, AI tell değil). |
| 25 | Jenerik pozitif kapanış | ✓ | Son somut gerçekle bitir; "gelecek parlak" deme. |
| 26 | Kısa çizgili ikili kelimeler (İng.) | ⊘ | Türkçe N/A; İngilizce'de attributive-yalnız kural işler. |
| 27 | Otorite kalıpları ("at its core, what really matters") | ✓ | Seremoniyi kes, düz söyle. |
| 28 | Signposting ("let's dive in") | ✓ | Yapacağını duyurma; yap. |
| 29 | Fragman başlık üstü ısınma | ✓ | Başlıktan sonra boş tek cümle koyma. |
| 30 | Diff-anchored yazı | ✓ | Dokümanı "önce şuydu şimdi şu" değil, o hâliyle anlat. (Post değil, teknik/doküman için.) |
| 31 | **Üretilmiş punchline / staccato drama** | ⚠ | Kısmi. Tek kısa cümle (`yeter`, `must be funny`) SEMİH'imzası — koru. AMA art arda 3+ kısa "quote-closer" yığma (o engineered). |
| 32 | Aforizma formülü ("X is the Y of Z", "X becomes a trap") | ✓ | İndirgenmiş parlak özdeyiş yerine somut iddia. Semih metafor kullanır ama zorlama değil, tekil ve bağlama oturmuş. |
| 33 | **Konuşma-dili retorik açılış ("Honestly? Look, Here's the thing")** | ⚠ | Kısmi. Tiyatral tek-kelime hook + arayı KES. AMA Semih'in doğal iç konuşma arayası (`mesela bunu paylaşmazdım, ama yazım stilim böyle olurdu`) KORU — o sahte-candor değil, gerçek. |

### "İnsan yazısı belirtileri — KORU" (skill'in listesi, Semih'e birebir uyar)
Bunları gördüğünde olsa bırak, aşırı-edit etme:
- Tuhaf, zor uydurulacak somut detay ("agent memory vault'una yazıyor, tek bir yere topluyor", "deepseek flash").
- Karışık his / çözülmemiş gerilim ("bir yere kadar", "hala keşfetmeye devam ediyorum").
- Dönemsel göndermeler (yıl/subkültür'e oturan jargondan).
- İlk-tekil editoryal karar (neden kesip kullandığını açıklayabilir).
- Cümle uzunluğu çeşitliliği (AI eşit-orta-kadans yerine kısa/uzun karışım).
- Gerçek ara söz / parantez / öz-düzeltme: `( :D )`, `(atm has no job at all might remove this)`.

---

## 3. LinkedIn / X post doğrulama checklist'i

Bir taslağı onaylamadan önce bu listeyi geçir. **Önce ses, sonra kalıp, sonra gerçek.**

**A. Ses (Semih mu?)**
- [ ] Konuşma akışı mı, kurumsal cila mı? (cila → düzelt)
- [ ] Var olan imza mı: araç/model adı, parantez itirafı, tek-hamle kuru mizah, `sanırım/bir yere kadar`?
- [ ] Aşırı özgüvenli/influencer kesinliği var mı? ("harika araç", "kesin çözer") → kes.
- [ ] Yapmadığı/yazmadığı kişisel kanaat onun ağzından mı söylenmiş? → kes veya `[Semih'in yorumu]` bırak.

**B. Kalıp (AI belirtisi)**
- [ ] Üçlü simetrik liste, retorik soru hook, zorlama metafor, jenerik CTA, "işte tam da bu yüzden" → kes.
- [ ] AI kelime haznesi (`crucial/foster/landscape/tapestry/vibrant`) → sadeleştir.
- [ ] Yığın hedging ("could potentially possibly"), aforizma formülü, signposting → kes.
- [ ] Art arda 3+ kısa punchline / quote-closer → düzleştir.
- [ ] Emoji, kıvrık tırnak, bold dekor → temizle.

**C. Gerçek / provenance (en önemli)**
- [ ] Cümledeki her sayı/olgu/karar kaynakta var mı? Kaynak yoksa kes, "yok" de, uydurma.
- [ ] `blocked` durumu (kaynak diske yok) → metin üretme; neden üretilemediğini açıkla.
- [ ] Türkçe+İngilizce karışımı doğal akıyor mu? (zorlanmış "terim çevirisi" değil)

**Geçme ölçütü:** A+B+C temiz, ve hiçbir cümle "uydurulmuş somut gerçek" taşımıyor. Ses korunmuşsa em dash gibi genel-istisnalar kabul.

---

## 4. Onur sınırı (parkerjam & public)

ParkerJam ve kişisel public içerikte **kesin ghostwriting yasağı**. Varsayılan çıktı:
`fact + link + doğrulama + raw bullet + [Semih'in yorumu]` placeholder. Bu dosya, Semih
kendi taslağını verip "boşlukları benim stilimle doldur" demedikçe **tam cümle/paragraf
üretme** emrini geçersiz kılmaz.

---

## Yayın kararı — platform eşleme (2026-09-03)

Semih'in onayladığı yol çizgisi: **agent/AI workflow dürüstlüğü + Movies Wrapped product kararları + zevk curation.**
X ile LinkedIn ayrımı şöyledir:

**X (kısa tekil karar, kuru mizah, araç adıyla anma):** #27 3-ay scraping, #1 Ghost, #12 AI 10px type floor, #5 plan-loop, #4 qmd/970 dosya, #10 Noé, #24 taste contradictions, #21 5-ay C.
**LinkedIn (product judgment, topluluk, büyük yay):** #27 (LinkedIn versiyonu), #2 5-ay kıyası, #22 tek gece MVP, #25 hobbies, #3 DS&A probe, context-continuity, staged-passes, telegram-silence, video-feedback-data, growth-builder.

- Zevek/Letterboxd içerik (#10, #24) LinkedIn'e girmez → X/Letterboxd. LinkedIn'de sadece yumuşak versiyon (kufürsüz).
- Tek günde tek platformda tek post (board ritüeli). Bir hikâye iki platformdaysa farklı kesişim yazılır.
- Öncelik sırası: X'te #12 (tek karar) + #27; LinkedIn'de #27.

## Bakım sözleşmesi

Semih her feedback verdiğinde (`bu ses değil`, `şöyle yazardım`, `risk almadı`) ilgili madde
buraya işlenir; dosya gittikçe keskinleşir, ilk sürüm sabit kalmaz. Content akışı her yeni
post taslağından önce bu dosyayı yeniden okur.
