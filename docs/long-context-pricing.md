# Uzun bağlam fiyatlandırması: neden var, kimlerde var, OMP'yi nasıl etkiledi

Tarih: 2026-10-23
Kapsam: xAI birincil dokümanları, diğer sağlayıcıların fiyat sayfaları, OMP kaynak/dokümanları ve yerel kullanım verisi.
İlgili dosya: `docs/grok-4-7-200k-cliff.md` (Grok 4.7 olayının ilk analizi).

## Kısa cevap

- **200k eşiği ve 2x çarpanı gerçek.** xAI'nin fiyat sayfası, model kartı ve cache dokümanı aynı şeyi söylüyor: prompt 200k'ya ulaşınca isteğin **tamamı** 2x fiyattan faturalanıyor. Cache'lenmiş tokenlar da eşiğe sayılıyor.
- **Grok'a özgü değil.** Anthropic, OpenAI, Google ve Qwen'de de prompt boyutuna göre kademeli fiyat var. Eşikler ve çarpanlar farklı.
- **"OMP Grok aboneliğinin haftalık havuzunu yaktı" iddiası kanıtlanmadı.** xAI'nin kendi sayfaları çelişiyor: biri API kullanımının ayrı faturalandığını ve havuza dokunmadığını söylüyor; başka bir sayfa ve canlı billing probe API'yi haftalık ürün kırılımında gösteriyor. Hangi muhasebenin geçerli olduğu belgelenmemiş.
- **OMP'nin dolar değerleri tahmindir.** OMP, abonelik arkalı modellerde eşleşen kamu API fiyatlarını kullanır ve bunu "API-eşdeğeri tahmin" olarak etiketler. Gerçek fatura değildir.
- **Kesin olan:** OMP'nin uzun oturumları çok sayıda ≥200k API isteği üretti. API liste fiyatında bu istekler 2x'tir. Bunun haftalık Grok havuzundan mı, ayrı API faturasından mı düştüğü açık değil.

## Doğrulanmış / doğrulanmamış

| İddia | Durum | Kanıt |
|---|---|---|
| xAI 200k üstünde tüm isteği 2x fiyatlıyor | **Doğrulandı** | [xAI pricing](https://docs.x.ai/developers/pricing): "billed at the higher rate for all tokens in the request" |
| Cache'lenmiş tokenlar eşiğe sayılıyor | **Doğrulandı** | [xAI prompt caching](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/usage-and-pricing) |
| Diğer sağlayıcılarda da kademeli fiyat var | **Doğrulandı** | Anthropic, OpenAI, Google, Qwen fiyat sayfaları |
| Abonelik havuzu ürün ağırlıklı yüzde | **Doğrulandı** | [usage limits](https://docs.x.ai/x-subscription/usage-limits): "Usage rates vary by product" |
| API kullanımı haftalık havuza dokunmuyor | **xAI sayfaları çelişiyor** | [x.ai/pricing](https://x.ai/pricing): "API usage is billed separately … doesn't draw from your plan's usage pool"; [Grok FAQ](https://docs.x.ai/grok/faq) ise ürün kırılımında "API" sayıyor |
| OMP'nin trafiği API ürün satırında | **Gözlem** | Canlı `omp usage` çıktısı; tek tek isteklerin hangi satıra yazıldığı yerelde yok |
| API satırının hareketi OMP'ye ait | **Doğrulanmadı** | OMP token hacmi ile yüzde artışı orantılı değil; aynı hesabı Grok CLI ve OMP Cursor rotası da kullanıyor |
| Abonelik havuzunda 2x uygulanıyor | **Belgelenmemiş** | Hiçbir xAI sayfası OAuth/abonelik kapsamını söylemiyor |
| OMP'nin $ değeri gerçek fatura | **Yanlış** | OMP: "API-equivalent estimate … rather than the user's bill" |
| `f150000` çalışma zamanında tetikleniyor | **Doğrulandı (mekanizma)** | `f8000` testi: 16.844 token'da `reason=threshold`, compaction yazıldı |
| `f150000` canlı 200k oturumunu kesiyor | **Doğrulanmadı** | 200k'lık canlı oturum test edilmedi; marj ölçümü aşağıda |

## 1. Nasıl ve neden oluyor

İki ayrı şey var:

1. **Teknik maliyet.** Self-attention, prompt uzunluğunun karesiyle büyür. 100k token, 1k token'ın 10.000 katı attention işi demek. Prefill sırasında bu maliyet bir kerede ödenir; KV-cache belleği ve batch verimliliği de uzun promptta kötüleşir. Sağlayıcılar bu yüzden uzun bağlamı ayrı fiyatlar. (İkincil kaynak: [Map the AI](https://maptheai.com/tutorials/why-attention-is-expensive/); sağlayıcıların çoğu gerekçeyi yazmıyor.)
2. **Faturalama tasarımı.** Kademe, yalnızca eşiği aşan tokenları değil **isteğin tamamını** yeniden fiyatlar. Bu bir "cliff" (uçurum), kademeli vergi dilimi değil. xAI, Anthropic, Google ve Qwen bunu açıkça söylüyor; OpenAI'nin sayfası "tüm istek" ifadesini kullanmıyor, ama iki fiyat sütunu ve "full session" ifadesi aynı sonucu veriyor.

Sonuç: 199k token'lık istek normal fiyat, 200k token'lık istek 2x. Aradaki 1k token, farkı iki katına çıkarır.

## 2. Başka modellerde var mı

Evet. 23 Ekim 2026 itibarıyla doğrulanmış örnekler:

| Sağlayıcı / model | Eşik | Uzun bağlam çarpanı | Kapsam |
|---|---:|---|---|
| xAI grok-4.7 / 4.6 / 4.5 | 200k | 2x input, cache, output | Tüm istek |
| xAI grok-4.3 / 4.20 / grok-build-0.1 | 200k | 2x | Tüm istek |
| xAI grok-4.7 Fast (Cursor/Build) | 200k | $4/$1/$12 → $6/$1,50/$18 | Plan içinde |
| Anthropic Claude Haiku 5.5 | 100k | 5x | Tüm istek |
| Anthropic diğer modeller | — | Düz fiyat (1M'e kadar) | — |
| OpenAI GPT-5.4/5.5/5.6/6 (mini/nano/cyber hariç) | 272k | 2x input/cache, 1,5x output | Tüm istek (OpenAI "full request" demiyor; iki sütun aynı sonucu veriyor) |
| Google Gemini 3.1 Pro / 2.5 Pro | 200k | 2x input/cache, 1,5x output | Tüm istek |
| Google Gemini 4 Argon / 3.8 Flash | — | Düz fiyat | — |
| Qwen (modele göre) | 32k–256k | Kademeli, tüm istek | Tüm istek |
| DeepSeek | — | Düz fiyat; yalnız peak/off-peak | — |
| Mistral | — | Düz fiyat; sert context cap | — |
| Cohere | — | Düz fiyat; 256k cap; kurumsal fiyat | — |

Kaynaklar: xAI pricing; Anthropic [pricing](https://platform.claude.com/docs/en/about-claude/pricing#long-context-pricing); OpenAI [pricing](https://developers.openai.com/api/docs/pricing); Gemini [pricing](https://ai.google.dev/gemini-api/docs/pricing); Alibaba [model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing); DeepSeek [pricing](https://api-docs.deepseek.com/quick_start/pricing/); Mistral [pricing](https://docs.mistral.ai/inference/pricing); Cohere [pricing](https://cohere.com/pricing).

Yani "Grok'ta böyle bir şey varmış" istisna değil. İstisna olan, eşiğin **200k** ve çarpanın **2x** olması.

## 3. Neden duymadım

Belgelenmiş ama görünür değil:

1. **Lansmanda söylenmedi, sonra eklendi.** Grok 4.5 lansmanı 8 Temmuz 2026'da düz $2/$6 ile duyuruldu. 200k kuralı aynı gün HN yorumlarında konuşuldu, ama lansman notunda yoktu; sonraki sürümlerin notlarında var. (HN 48835111, 48853697.)
2. **Başlık fiyatı eşiksiz.** [x.ai/api](https://x.ai/api) kartında "500k context" ve "$2/M input" yazıyor; 200k uyarısı yok. Tam fiyat docs'a bırakılmış.
3. **Fiyat tablosunda satır etiketi.** Kademe ayrı bir "uzun bağlam" bölümü değil; model adının yanında `< 200k` / `≥ 200k` olarak duruyor. 8 model, 16 satır; ikinci satır kolayca atlanıyor.
4. **Uyarı yok.** xAI istek öncesi veya yanıt içinde eşik uyarısı göndermiyor. `cost_in_usd_ticks` yalnızca istek **sonrası** maliyeti veriyor. Konsol uyarısı aylık harcama limitinin %80'i için; 200k için değil.
5. **İstemci varsayılanları geç.** OMP varsayılanı pencerenin %85'i (500k'da 425k). Grok CLI varsayılanı da `auto_compact_threshold_percent = 85` (425k). Yani varsayılan davranış, eşiği geçmeyi garanti eder.
6. **Eşikler taşınmıyor.** xAI 200k, OpenAI 272k, Anthropic Haiku 5.5 100k, Cursor'ın Grok rotası 256k. Birini öğrenmek diğerini kapsamıyor.
7. **Gizli token payı.** xAI'nin faturalama SSS'i, isteğe ön tanımlı tokenlar eklendiğini söylüyor. Yerel sayacın 199k göstermesi, faturanın ≥200k olmasını engellemiyor.

## 4. OMP ve abonelik bağlantısı

### Gözlenen

- OMP'de `xai-oauth`, SuperGrok/X Premium+ OAuth ile `https://api.x.ai/v1/responses` üzerinden çalışır. Abonelik arkalı bir yoldur; API anahtarı faturalaması değildir. (`omp://provider-quirks.md`)
- Canlı `omp usage` çıktısı (23 Ekim 2026):

```text
SuperGrok Weekly Credits  87.0%
API (Weekly)              63.0%
GrokBot (Weekly)          21.0%
Cursor (Weekly)            2.0%
Grok Build (Weekly)        1.0%
```

- Bu çıktıda GrokChat satırı yok (0 veya gizli). Credits yüzdesi, görünen ürün satırlarının toplamına eşit: `63 + 21 + 2 + 1 = 87`. 16 Ekim kaydında da `32 + 31 + 26 + 4 + 7 = 100`.
- Bu hafta (20 Ekim 05:05 UTC'den beri) OMP'de grok-4.7: 2.744 çağrı, 19,46M cache'siz input + 2,35M output, 230,3M cache read. API-eşdeğeri tahmin **$214,20**. Bunun 298 çağrısı ≥200k; bu çağrıların API-eşdeğeri maliyeti $92,13, 2x farkı tahmini **$46,06**.
- OMP `stats`/dashboard "API-equivalent estimate" der; `packages/stats/README.md` bunu "the user's bill" değil diye tanımlar.

### Çelişki

- x.ai/pricing SSS: **"API usage is billed separately at standard model rates and doesn't draw from your plan's usage pool."** Cursor'ın aynı sorusu da aynı cevabı veriyor.
- Grok FAQ ise kullanım kırılımını **"(API, Build, Chat, Imagine, Voice)"** diye listeliyor. Yani aynı doküman ailesi API'yi hem havuz dışında hem haftalık kırılım içinde gösteriyor.
- Canlı billing probe, API yüzdesini haftalık credits toplamıyla birlikte veriyor. Bu, API'nin ayrı bir sayaç mı yoksa havuzun bir dilimi mi olduğunu netleştirmiyor.

### Neden atıf yapamıyoruz

- OMP'nin token hacmi ile API yüzdesi orantılı değil. 13–15 Ekim arasında 153,5M token akarken API satırı yoktu/0,01'di; sonraki 124,2M token +30 puan getirdi. Bu, tek bir sayacın doğrusal davranışı değil.
- Aynı xAI hesabı bu makinede başka istemcilerle de kullanılıyor: Grok CLI (Build rotası) ve OMP'nin `cursor` sağlayıcısı (Cursor rotası). Yüzdeler 1 puan çözünürlüğünde; hangi istemcinin hangi puanı ürettiği yerelden görülemiyor.
- `usage_history` tablosu 17 Ekim'den sonra örnekleme yapmıyor; canlı `omp usage` daha yeni. İkisi arasında boşluk var.

### Doğru cümle

> OMP'nin uzun oturumları çok sayıda ≥200k API isteği üretti. API liste fiyatında bu istekler 2x'tir. Bunun X aboneliğinin haftalık havuzundan mı, ayrı API faturasından mı düştüğü xAI dokümanlarında çelişkili; yerel veriyle atıf yapılamıyor. OMP'nin dolar değerleri gerçek fatura değil, API-eşdeğeri tahmindir.

## 5. Pratik sonuç

- OMP'de `f150000` doğru yöndür: hem token hacmini hem 200k'ya yaklaşma olasılığını düşürür. Mekanizma doğrulandı; canlı 200k oturumu henüz doğrulanmadı.
- Grok CLI'ye geçmek tek başına çözüm değil: varsayılan eşiği 425k. `~/.grok/config.toml` içinde `[session] auto_compact_threshold_percent = 30` yazılmadan aynı banda girer.
- Hangi muhasebe geçerli olursa olsun, uzun oturum daha çok token yakar; 150k'da kesmek kazandırır.
- "Gerçek fatura"yı öğrenmenin tek yolu: xAI panelindeki API satırının, bilinen bir oturum öncesi/sonrası yüzdesini ölçmek. API-eşdeğeri dolar bu soruyu cevaplamaz.

## 6. Kaynaklar

Birincil:
- https://docs.x.ai/developers/pricing
- https://docs.x.ai/developers/models/grok-4.7
- https://docs.x.ai/developers/advanced-api-usage/prompt-caching/usage-and-pricing
- https://docs.x.ai/x-subscription/usage-limits
- https://docs.x.ai/x-subscription/overview
- https://docs.x.ai/x-subscription/extra-usage
- https://docs.x.ai/grok/faq
- https://docs.x.ai/build/settings/reference
- https://x.ai/pricing
- https://cursor.com/docs/models-and-pricing
- https://platform.claude.com/docs/en/about-claude/pricing
- https://developers.openai.com/api/docs/pricing
- https://ai.google.dev/gemini-api/docs/pricing
- https://www.alibabacloud.com/help/en/model-studio/model-pricing
- https://api-docs.deepseek.com/quick_start/pricing/
- https://docs.mistral.ai/inference/pricing
- https://cohere.com/pricing

İkincil / topluluk:
- https://apicostcheck.com/long-context-pricing/
- https://maptheai.com/tutorials/why-attention-is-expensive/
- https://news.ycombinator.com/item?id=48835111 (kuralın lansman günü konuşulduğu)
- https://news.ycombinator.com/item?id=48853697 (aynı konu; fiyat rakamı için kullanma)

OMP yerel:
- `omp://provider-quirks.md` (`xai-oauth` bölümü)
- `omp://models.md` (maliyet tahmini)
- `~/.omp/agent/agent.db` (`usage_history`)
- `~/.omp/stats.db` (`messages`)
