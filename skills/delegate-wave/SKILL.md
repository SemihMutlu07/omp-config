---
name: delegate-wave
description: |
  Ucuz ana ajan, pahalı işi pano'ya devreder. Pi + DeepSeek + Herdr panosu üzerinden
  okuma/keşif/tarama ve paralelleştirilebilir alt işleri herdr_agent panolarına dağıt,
  settlement bekle, sonucu oku ve özetle. Ana bağlamı ucuz tut. Use when the user says
  "delegate", "delegate-wave", "herdr'e dağıt", "pano'ya ver", "subagent'e yazdır",
  or asks to scan/read/explore something while keeping main context cheap.
---

# delegate-wave

Tweet'ten (2026-08-21): *"Use pi in tmux with deepseek-v4-pro/deepseek-v4-flash.
All read, discovery, and changes should be delegated to pi. Your role is to review
and delegate."* — Burada pi = ana ajan (deepseek-ucuz), pano = herdr agent'ları.

## Çekirdek kural

> **2026-08-22 karar (Semih):** Pi ANA harness. Hermes yerel harness değildir;
> başka bilgisayarda Telegram üzerinden ulaşılan uzak automation node'udur.
> Cron, bildirim ve doğrulanmış browser otomasyonlarında kullanılır;
> Pi/Herdr interactive coding orkestrasyonunun yerine geçmez.

- **Ana ajan (ben):** okuma/keşif/tarama işini kendin yapma; ucuz kal.
  Karar, sentez, review ve tek-dokunuş düzeltmeleri bende kalır.
- **Okuma/keşif/tarama + paralel alt işler:** herdr panolarına devret.
- **Model politikası:** Agent'lar model/effort ayarını DEĞİŞTİRMEZ — Semih ayarlar.
  - Pi Flash: varsayılan orchestrator/writer.
  - Pi Pro: LONG/MESSY/hard-debug/review.
  - Cursor Grok 4.6 high: plan taslağı ve alternatif advisor.
  - Sol high: kritik final advisor.
  - AGY Gemini 3.7: güncel araştırma.
- **Resimli görevler** (ekran görüntüsü/UI analizi vb.): `deepseek-v4-flash-vision-exp`
  kullanılabilir (aynı fiyat, resimler token olarak sayılır) — karar anında verilir.
- **Hermes/Browser pilotu:** X bookmarks, remote Hermes/Browser Use pilotudur; cron henüz
  kanonik değildir. İki başarılı manuel çalışmadan sonra kalıcı otomasyon kuralına yükseltilir.

## Ne zaman devredilir (tetikleyici)

- Geniş dosya ağacı / repo taraması, "50+ dosyayı oku ve sonuç çıkar"
- Keşif: başka repo, docs, benchmark, log yığını incelemesi
- Paralel bağımsız alt işler (aynı anda 2-3 bağımsız görev)
- Uzun test/build/format döngüleri

Devretme: tek dosya düzeltmesi, kısa grep, karar verme, Semih'le konuşma.

## Topoloji sözleşmesi (2026-08-22, Semih onaylı)

```
Space (workspace)  → maksimum 10 (toplam)
 └─ Window (tab)   → her space'te maksimum 10; konu odaklı isimli
                      (örn. research, test, review, feat-1)
     └─ Pane       → her window'da maksimum 6
```

- **Ana ajan = space orchestrator:** hangi space/window/pane'e kimin
  çalışacağını o karar verir; sentez ve karar ana ajanda kalır.
- **Window isimleri fonksiyondan** türesin: `research`, `test`, `review`,
  `feat-1`… Agent isimleri buna uyumlu: `research-1`, `test-2` gibi.
- **Takılma politikası:** takılan pane/window'u orchestrator düzeltir;
  kapasite dolarsa iş bekleme kuyruğuna girer, yapı zorlanmaz.
  Aç-kapat orchestrator'ın sorumluluğu; yaratmadığı pane'i Semih demeden kapatmaz.
- Eşzamanlı **çalışan** agent üst sınırı hâlâ 8'dir (AGENTS.md çökme koruması);
  topolojik slotlar bunun üstünde yapısal sınırdır.
- Devredilen her prompt'ta "alt-agent açma" yasağı tekrarlanır.

## Multi-feature playbook (2026-08-23, Semih onaylı)

Aynı projede birden çok feature açılacaksa:

**Topoloji:** Her feature kendi **window**'unda izole bir birimdir.
Window adı feature kimliğidir: `<proje>-f<n>-<isim>` (örn. `ppo-f2-seen-items`).
Her window'da: **pane 1 = orchestrator** (o feature planının sahibi),
pane 2..6 = pi instance'lar (worker / verifier / excavation).
Ana ajan sadece workspace + window'ları kurar, planları dağıtır ve sonunda
digest verir — döngünün sahibi pencere-içi orkestratördür.

**Sert kurallar:**
- Window başına max **6 pane**; 7. ihtiyaç yeni pane değil bekleme kuyruğu.
- Eşzamanlı çalışan agent üst sınırı 8 (global kural) geçilmez.
- Paralellikten önce **çakışma analizi:** aynı dosya/modüle dokunan feature'lar
  seriye çekilir (F2 bitince F4 gibi). Kuyrukta bekleyen feature'ın window'u
  sırası gelince açılır.
- **MESSY feature kodla başlamaz:** önce excavation pass (OUTCOME'u "STATE.md
  üret", kod değil).

**Deterministik döngü (her window'da aynı):**
1. Orchestrator intent v0 yazar (worker'a yazdırmaz), işi sınıflandırır
   (SHORT/LONG/MESSY), worker'lara 4 bloklu prompt dağıtır.
2. Settlement beklenir (polling yok).
3. **Verifier ayrı pane'de** CHECK komutunu kendisi koşar; ham çıktı diske
   yazılır (VERIFY.md). Yapanın iddiası kanıt değildir.
4. **İnsan review paketi:** ana Pi `git diff --stat`, `git diff --name-status`
   ve dosya bazlı patch'i okur; Semih'e `dosya → neden → davranış → test`
   makbuzu verir. Küçük diff tam gösterilir, büyük diff `lazygit` ile açılır.
5. Sonuç etiketi: diskte kanıt varsa `done`, yoksa `claimed` — claimed iş
   bitmiş raporlanmaz.
6. Merge'i orchestrator yapar (worker merge etmez); ana repoda smoke test;
   sonra **pane'ler ve window kapanır.** Kapalı window = bitmiş iş;
   kanıt VERIFY.md'dedir, canlı oturumda değil.
7. Ledger'a tek satır: kim, ne, hangi check, kanıt dosyası nerede.

**Worker prompt şablonu (istisnasız):**
```text
OUTCOME: <tek cümle sonuç>
SOURCE: <worktree yolu, branch, intent bölümü, doküman>
CONSTRAINT: <dokunma yasakları> + yeni dependency yok + alt-agent açma + push/deploy yok
CHECK: <en dar doğrulama komutu + beklenen çıktı, ham çıktı rapora yapıştırılır>
BÜTÇE: LOC: +x/1500 takip et (feature işiyse)
```

**Semih'e digest (tek mesaj):** her feature için bir satır — etiket (done/
claimed/blocked) + kanıt linki + LOC + karar bekleyen nokta. Kazma yok;
sinyal yoğun selection listesi.

## Review pane (diff izleme)

Worker kod yazarken Semih'in canlı diff görmesi için sabit konvansiyon:

```
[worker pane]  pi / codex — kod yazar (worktree cwd)
[review pane]  review-diff <worktree-yolu>
```

- `review-diff` = `~/.local/bin/review-diff` → 2 sn'de bir `git status` + `git diff` (TUI yok, tuş yok).
- İsteğe bağlı okunabilirlik: `git-delta` kuruluysa patch renkli/side-by-side gelir.
- En kolay GUI: repoyu Cursor'da aç → Source Control (`Ctrl+Shift+G`) → dosyaya tık.
- Review pane worker ile **aynı worktree**'yi izlemeli; ana repo cwd'si yanlış diff gösterir.
- İş bitince ana pi `/review-changes [base-ref]` ile makbuz.
- Harness kurma yok (Aider/OpenHands/lazygit değil).

## Workflow (pi-herdr tool'larıyla)

> **Task ownership (2026-09-30, Semih):** Pi + Herdr is the main interactive path.
> For authorized delegation, Pi chooses and manages task topology: independent
> task → unfocused named tab; closely related work → panes; larger isolated
> effort → workspace. Pi owns cleanup of IDs it created, not the user's sessions.
> Capture results and verify task checks before calling work complete. Preserve
> failure evidence and close only owned resources; if a user adds a pane to the
> tab, preserve that pane and close only the worker. Never infer completion from
> `idle`/`done` alone. Provider errors or stalled work must return a blocker within
> the allotted budget, not start uncontrolled retries or silent model substitutions.

1. **Task surface:** Follow the current `herdr` skill and installed CLI.
   Independent task: `herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label <task> --no-focus`.
   Record returned root-pane and tab IDs. Related work may use `pane split`.
   Pi manages the surfaces it creates; no separate cleanup burden for Semih.
2. **Agent başlat:** `herdr_agent` → `start` — `name` (tekil), `kind` (codex|pi|...),
   `pane`. `agentArgs` ile native argümanlar (`--` sonrası) geçebilirsin.
3. **Prompt + bekle:** `prompt` — net görev: "repo/klasör, sınır, owned files,
   off-limits, çıktı formatı". `wait` default true; `timeout` ver.
   `blocked` dönerse incele (`read`/`send_keys`). **ZORUNLU: settlement bekle —
   polling yapma ("2 dakikada bir kontrol et" yok); lifecycle döndürmeden iş
   bitti sayılmaz. `unknown` = belirsiz, tamam sanma, doğrulamadan raporlama.
4. **Oku + sentezle:** `read` (`source: recent-unwrapped`, `lines` artır).
   Tam ekran (alternate screen) kesilirse: agent'tan sonucu **repo dışı** geçici
   yola (`/tmp/...`) yazmasını iste, dosyayı oku. Repo'ya ASLA yazdırma
   (read-only görevde kirlenme olmasın).
5. **Kapat:** kendi yarattığın panoyu kapatabilirsin (`herdr_pane close` —
   kendi pane'ini kapatmayı reddeder). Yaratmadığın panoyu Semih demeden kapatma.

## Kısıtlar

- Authorized task delegation includes creating and managing the needed Herdr
  tabs/panes/workspaces. Only owned resources may be closed automatically.
  Tiny edits and decisions stay with the main agent; do not delegate merely
  to create more chats. Explicit model/effort choices override agent profiles;
  verify the launched settings. Use separate Pi `--model` and `--thinking` flags.
- Pane/tab/workspace ID'leri opak — hep tool'dan döneni kullan, elle üretme.
- `agent_prompt_stalled` (5sn'de lifecycle değişimi yok) → yeniden dene veya pane'i oku.
- Çıktı limiti: 2000 satır / 50KB. Daha fazlası için agent'a repo DIŞI (/tmp)
  dosyaya yazdır; repoya yazdırma.
- Devredilen işin sonucunu doğrula: test/log/disk kanıtı olmadan "bitti" deme.

## Örnek

```json
{ "action": "pane_split" }                       // → pane w1:p2
{ "action": "start", "name": "scanner", "kind": "codex", "pane": "w1:p2" }
{ "action": "prompt", "target": "scanner", "timeout": 120000,
  "prompt": "~/dev/movieswrapped içinde PostHog event tanımlarını bul, eksikleri listele. Sadece rapor: dosya:satır + event adı. Dosya değiştirme." }
{ "action": "read", "target": "scanner", "source": "recent-unwrapped", "lines": 120 }
```

## Doğrulama

- Kurulum: `pi install npm:@ogulcancelik/pi-herdr`; tool'lar `HERDR_ENV=1` +
  `HERDR_PANE_ID` set ise aktif olur (pi restart gerekir).
- Smoke test: `herdr agent list` CLI'da çalışıyorsa pano altyapısı sağlam.
