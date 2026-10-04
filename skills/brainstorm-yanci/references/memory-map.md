# Memory map — "Semih kim / neler oluyor" yükleme haritası

Yancı'nın hatırlama katmanı. Sırayla oku; her dosya bir işi görür. Boş/eksik
dosyayı uydurma — "okunamadı" de.

## Giriş kapıları (önce bunlar)
| Dosya | Ne verir | Oku |
|---|---|---|
| `~/AgentMemory/INDEX.md` | "Last updated" + son 30 günün olayları; front door | `head -40` |
| `~/AgentMemory/projects/wayfinder.md` | İş kuyruğu — TEK sahibi. Açık/kapalı işler | tamamı |
| `~/AgentMemory/profiles/00-index.md` | Çağrı sözleşmesi, izinli çağrı grafiği, normlar | tamamı |
| `~/AgentMemory/profiles/01-default.md` | Semih'in default profili: rol, model, kapsam, kural | tamamı |
| `~/AgentMemory/AGENTS.md` | Vault sözleşmesi (yazma disiplini, golden rule, cron) | tamamı |

## Niş bağlam (göreve göre)
| Görev türü | Dosya |
|---|---|
| Ürün yönü / fikir | `projects/solopreneur-personal-os.md`, `ideas/`, `learning/04-homo-promptus.md` |
| Karar geçmişi | `decisions/<tarih>-<konu>.md` (tarih önekli, kanonik) |
| Ders / tekrarlanan hata | `lessons.md`, `errors/` |
| Dış içerik | `captures/<tarih>-*.md` |
| Araştırma çıktısı | `research/<tarih>-*.md` |
| Kişiler / ekip | `people/<ad>.md` |
| Canlı devir | `profiles/HANDOFF.md` |

## Arama sırası (içerik sorusu)
1. Yapısal giriş: `INDEX.md` + `wayfinder.md`.
2. İçerik: `qmd query $'lex: ...\nvec: ...' --format files -n 5` (typed, Türkçe).
3. Ham arama: `qmd search "<terim>" --format files -n 5` (BM25, hızlı).

## Hatırlarken dikkat
- `raw/` = ground truth, ASLA yazma; kaynak göstermeden iddia yazma.
- `learn/` (tekil) bayat — yeni yazım `learning/` (çoğul).
- `current/` bayat; güncel durum `INDEX.md` + `wayfinder.md`.
- Em dash kullanma; tek dil; kısa.
