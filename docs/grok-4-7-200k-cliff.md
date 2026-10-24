# Grok 4.7 maliyet araştırması: 200k eşiği, cache fiyatı ve sessiz fallback

Tarih: 2026-10-23
Kapsam: OMP `stats.db` yerel verisi + birincil kaynaklar + topluluk raporları.

## Sonuç

Grok 4.7'nin cache'i bozuk değil. Asıl maliyet iki yerden geliyor:

1. **200k token eşiği.** xAI, prompt 200k'ya ulaşınca isteğin tamamını 2x fiyattan faturalıyor. Cache'lenmiş tokenlar da bu eşiğe sayılıyor.
2. **Cache fiyatı.** Cache read, input fiyatının %25'i ($0,50 / $2,00). Karşılaştırılan modellerde bu oran %5–10. Cache isabeti yüksek olsa bile token başına maliyet yüksek kalıyor.

Üçüncü ve henüz açıklanmamış risk: alt ajanların hata/limit sonrası grok'a düşmesi.

## Yerel ölçüm (16–23 Ekim 2026)

Kaynak: `~/.omp/stats.db`, `xai-oauth/grok-4.7`.

| Ölçüm | Değer |
|---|---:|
| Çağrı | 3.463 |
| API-eşdeğeri maliyet | $326,55 |
| Cache isabeti | %93,9 |
| Çağrı başına bağlam | ~107,8k token |
| ≥200k çağrı | 594 (%17,2) |
| ≥200k çağrıların maliyeti | $177,28 (faturanın %54,3'ü) |
| ≥200k çağrıların token payı | %42,4 |
| Sadece 2x çarpanının ek ücreti | ~$88,64 (faturanın %27,1'i) |
| En büyük bağlam | 426k token |

Referans modeller, aynı hafta:

| Model | Cache isabeti | 1M token başına API-eşdeğeri |
|---|---:|---:|
| grok-4.7 | %93,9 | $0,868 |
| gpt-6.1-sol | %94,4 | $0,248 |
| gemini-3.8-flash | %94,1 | $0,130 |

Advisor ve alt ajan grok harcaması: sırasıyla $46,91 ve $88,89. Alt ajan harcamasının $83,73'ü (%94), başka modelle başlayıp grok'a fallback yapan oturumlardan.

## Birincil kaynaklar

- xAI fiyat tablosu: grok-4.7 için <200k $2/$0,50/$6; ≥200k $4/$1/$12. "Requests whose prompt reaches the listed token threshold are billed at the higher rate for all tokens in the request."
  <https://docs.x.ai/developers/pricing>
- xAI cache dokümanı: "Long context pricing applies when total prompt tokens (including cached tokens) exceed the model's long context threshold."
  <https://docs.x.ai/developers/advanced-api-usage/prompt-caching/usage-and-pricing>
- xAI model kartı: 500k context, reasoning low/medium/high/xhigh.
  <https://docs.x.ai/developers/grok-4-7>
- Cursor'ın kendi rotası: long-context faturalaması 256k input üstünde başlıyor. Yani eşik, rotaya göre değişiyor.
  <https://cursor.com/docs/models/grok-4-7>
- OMP `xai-oauth`: SuperGrok OAuth ile `https://api.x.ai/v1/responses` üzerinden çalışır.
  `omp://provider-quirks.md`

## Topluluk raporları

- HN, 8 Temmuz 2026: "$2/6 pricing seems to only apply for context under 200K. Above that pricing doubles." Aynı tartışmada: "Long agentic workflows are dominated by cached input. US frontier labs typically have this at 10% of the input price, DeepSeek/Xiaomi 1%."
  <https://news.ycombinator.com/item?id=48835729>
- HN, aynı tartışma: "Womp. Didn't see this anywhere else. No longer feels as inexpensive. Will likely just include this in the rolodex of <200k context tasks."
- HN, Grok 4.7 lansmanı (540 yorum): "$0.50 for cache reads, which is 25% of input. While other models are 10% of input."
  <https://news.ycombinator.com/item?id=49788838>
- HN, 4.5 tartışması: eşiğin lansman duyurusunda yer almadığı, çok turlu kodlamayı beklenenden pahalı yaptığı belirtiliyor.
  <https://news.ycombinator.com/item?id=48853697>
- r/cursor: "Grok 4.7 feels like a huge token sink with barely any noticeable improvement over 4.6. Anyone else?"
  <https://www.reddit.com/r/cursor/comments/1wu9jj0/grok_47_feels_like_a_huge_token_sink_with_barely/>
- Cursor forum: "It is a bit smarter, but per task it spends almost twice as many tokens as Grok 4.6."
  <https://forum.cursor.com/t/share-your-thoughts-on-grok-4-7/172527?page=5>
- Cursor forum, aynı hata sınıfı: alt ajan açıkça seçilen modelle başlıyor, devam ettiğinde sessizce daha pahalı varyanta düşüyor. Cursor yetkilisi: "the fallback variant is the one that actually runs, not just the one that gets displayed."
  <https://forum.cursor.com/t/task-subagent-silently-remaps-allowlisted-grok-to-high-fast/167211>

## Analizler

- 200k uçurumunun tam istek üzerinden hesabı: prompt %5 büyüyünce fatura %110 artabiliyor.
  <https://apicostcalc.com/blog/grok-4-7-200k-token-pricing-cliff.html>
- 250k prompt: grok $1,10, GPT-6 Sol $0,71, Opus 5.5 $1,16. Sabit 450k bağlamda tekrarlı çağrı: grok $11,40, Sol $6,94, Opus $5,47.
  <https://pirouter.ai/blog/long-context-price-cliff-grok-4-7-gpt-6-opus-5-5>
- Artificial Analysis verisiyle: Grok Build 4.7 xhigh, %94 cache isabetine rağmen görev başına 14,3M token ve $8,82 harcıyor. 4.6 xhigh: 5,5M token, $3,57.
  <https://merginit.com/blog/25092026-grok-4-7-cost-of-finishing-tasks>
- Eşik + Fast + araç ücretleri özeti: "the run gets quietly twice as expensive the moment it tips over, and nothing in the response headers waves a flag."
  <https://www.eesel.ai/blog/grok-4-7-pricing>
- Rota farkı: xAI API 200k'da, Cursor 256k'da faturalıyor.
  <https://www.llmrumors.com/news/grok-47-task-cost-context-routing>

## OMP'ye özel bulgular

- `xai-oauth` dolar değerleri **API-eşdeğeri tahmindir**, gerçek fatura değildir. PR #9515 bu etiketi ekledi.
  <https://github.com/can1357/oh-my-pi/issues/9512>
  <https://github.com/can1357/oh-my-pi/pull/9515>
- `xai-oauth`, Grok Build kotası yerine xAI API kotasını tüketiyor.
  <https://github.com/can1357/oh-my-pi/issues/6245>
- Alt ajan fallback'i, rol zincirini veya `retry.fallbackChains.default` zincirini kullanır.
  <https://github.com/can1357/oh-my-pi/issues/2912>
- Fallback seçimi hedef modelin context penceresini kontrol etmiyordu; düzeltildi.
  <https://github.com/can1357/oh-my-pi/issues/8065>

## Düzeltilen iki hata

1. "%54 ek ücret" yanlış. %54, ≥200k çağrıların toplam faturadaki payı. 2x çarpanının kendisi ~$88,64, yani %27. Bağlamı 200k altına indirmek token sayısını da düşürür; toplam tasarruf bu iki etkinin birleşimidir.
2. "Alt ajana açık model vermek yeter" yanlış. İncelenen `phys-notes-1` alt ajanı zaten `subagent:phys-notes-1 → gpt-6-luna` ile başladı ve yine grok'a düştü. Fallback seçicisinin neden grok'u seçtiği bilinmiyor. Yapılandırılmış `task` ve `default` zincirlerinde grok yok.

## Açık bilinmeyenler

- Fallback neden `deepseek-v4-pro` veya `gpt-6.1-sol` yerine grok'u seçti?
- SuperGrok planı kota aşımını dolarla mı faturalıyor, yoksa yalnızca sınırlıyor mu? Konsol kontrolü gerekir.
- `compaction.modelThresholds` için yazılan `f150000` çalışma zamanında gerçekten 150k'da tetikleniyor mu? Config yüklendi; `/models` önizlemesi TUI'de kaldı ve canlı 200k oturum test edilmedi. Bu satır unverified.
- Ölçülen tek tur sıçraması (grok-4.7, 16–23 Ekim): main max 38.093; subagent max 48.616; advisor max 100.475. Tetik 150k, main+subagent için 198.616 < 200k. Advisor'ın 100k'lık sıçramaları (1.124 turun 4'ü) bu tetikle yine eşiği aşabilir.

## Başkalarına uyarı metni

> Grok 4.7'de cache'i suçlamayın. Cache isabeti %94 olabilir; sorun cache'in fiyatı ve 200k eşiği.
>
> 1. Prompt 200k'ya ulaşınca xAI **tüm isteği** 2x faturalar: $4 input / $1 cached / $12 output. Cache'lenmiş tokenlar da eşiğe sayılır.
> 2. 500k pencereli bir modelde varsayılan compaction 425k'da tetiklenir. 200k–425k arası sessizce 2x banttır.
> 3. Ajan oturumlarında fatura cache read'den gelir. Grok'ta cache read, input'un %25'i; Sol'da %5, Gemini'de %10.
> 4. Model yönlendirmesini izleyin. Alt ajan veya advisor limit/hatada sessizce daha pahalı bir modele düşebilir.
> 5. OMP'de `xai-oauth` dolar değerleri API-eşdeğeri tahmindir; gerçek maliyet SuperGrok kotasıdır.
>
> Somut önlem: `compaction.modelThresholds` ile modeli 150k'da compact et. Uzun ajan işlerini sabit fiyatlı modellere ver. Fallback zincirini ve gerçek model kimliğini oturum kayıtlarından doğrula.
