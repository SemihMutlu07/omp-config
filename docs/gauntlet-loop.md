# Gauntlet Loop

Kısa bir kod isteği yeterli: mevcut bağlamdan kısa spec çıkar → uygula → kendi
kontrolünü çalıştır → bağımsız incelet → ilgili testleri/gerçek akışı doğrula →
gerekirse en fazla iki kez düzelt. Belirsiz ürün kararı, eksik inceleme yeteneği
veya iki başarısız düzeltme turunda kanıtla insana devret.

Kanonik spec ve bu kurulumun sonucu:
https://app.notion.com/p/3fe4b6f58b3b8134aedaf8e4b73df939

## Kullanım

Codex ve OMP'nin yeni yerel oturumları için normal kod, script ve çalıştırılabilir
yapılandırma taleplerini bu akışa yönlendiren varsayılan talimat kuruldu.
Cursor için ortak skill ve kural dosyası hazır. Bu makinedeki mevcut `sessionStart`
hook'unun kuralı bağlama ekleyen çıktısı doğrulandı; gerçek Cursor oturumunda
çalışması ayrıca doğrulanmalı. Gerekirse Customize → Rules altında User Rule
olarak "Kod değişikliklerinde gauntlet-loop skill'ini otomatik kullan" ekle.
Örneğin: "Bu hatayı düzelt" veya "Bu repoya CSV dışa aktarma ekle".
Salt okuma ve yalnız plan istekleri değişiklik başlatmaz.

| Ortam | Elle giriş |
| --- | --- |
| Codex | `$gauntlet-loop <görev>` |
| OMP | `/skill:gauntlet-loop <görev>` |
| Cursor | Skill seçicide `gauntlet-loop`; görünüyorsa `/gauntlet-loop <görev>` |
| ChatGPT | Yerel plugin yüklendikten sonra `@` seçicisinden Gauntlet Loop |

Skill bulunamıyorsa ajana `~/.agents/skills/gauntlet-loop/SKILL.md` dosyasını
okuyup uygulamasını söyle. Bu fallback bağımsız reviewer veya test aracı sağlamaz;
gereken yetenek yoksa sonuç açıkça `BLOCKED/PARTIAL` kalır.

## Yerel kurulum ve güncelleme

```bash
python3 ~/dev/omp-config/scripts/install-gauntlet-loop.py
python3 ~/dev/omp-config/scripts/install-gauntlet-loop.py --check
```

Tek bakımlı kaynak `skills/gauntlet-loop/` dizinidir. Kurucu:

- Codex ve Cursor için `~/.agents/skills/gauntlet-loop/` altına gerçek dosyaları kopyalar.
- OMP'nin mevcut skill kaynağını ve AGENTS symlink'ini kullanır.
- Codex, OMP ve Cursor talimatlarına yalnız işaretli varsayılan blok ekler.
- ChatGPT için `~/.codex/plugins/gauntlet-loop/` paketini ve kişisel kataloğu hazırlar.
- Değiştirdiği mevcut dosyaları `~/.local/state/gauntlet-loop/deploy-*/` altında
  yedekler; `restore-map.json` özgün hedefleri gösterir. Mevcut model, credential
  ve hook ayarlarını değiştirmez.

Kaynak skill değişince kurucuyu yeniden çalıştır. `--check` yazmadan dağıtım
farklarını bildirir. İlk kaynak yedeği ve doğrulama kanıtları aynı state kökündedir.

## ChatGPT desktop'ta son adım

Bu bilgisayardaki kişisel katalog `~/.agents/plugins/marketplace.json`, paket ise
`~/.codex/plugins/gauntlet-loop/` konumundadır. Uygulamayı uygun zamanda yeniden
aç; Plugins Directory'de Semih Local kaynağından Gauntlet Loop paketini
yükle ve yeni bir Work/Codex sohbetinde `@` seçicisinden kullan.

Bu paket yayımlanmaz. Başka bilgisayardaki uygulama veya web hesabı yerel dosyaları
otomatik almaz. Hesap/istemci özelliği yoksa aynı skill'i desteklenen ortamda kullan.
Cloud Work'te plugin hook'ları desteklenmediğinden bu paket zorlayıcı bir hook içermez.

## Kanıt sınırı

Varsayılan talimatın kurulması, yeni oturumun onu keşfetmesi, gerçek döngünün
çalışması ve kullanıcının sonucu kabul etmesi ayrı sonuçlardır. Bu kurulum
arka plan zamanlayıcı veya atlanamaz bir bitiş kapısı kurmaz. Reviewer ve gerçek
kontroller eksikse "hazır" denmez; commit/push/deploy ayrıca yetki gerektirir.

## Kaynaklar

- https://learn.chatgpt.com/docs/build-skills
- https://developers.openai.com/plugins/build/plugins
- https://cursor.com/docs/skills
- Kurulu OMP: `omp read omp://skills.md` ve `omp read omp://tools/task.md`
