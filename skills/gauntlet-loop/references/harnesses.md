# Platform ve Harness Uyarlamaları

Gauntlet Loop genel ve taşınabilir bir doğrulama prensibidir; belirli bir harness'a, modele veya sağlayıcıya kilitli değildir. Her ortamda mevcut yerel (native) araç ve rol yönlendirmesini kullanır.

## Temel İlkeler

- **Hardcoded model ve kota yok:** Ortak çekirdekte sabit model/provider ID'leri, zorunlu Herdr bağımlılığı, küresel eşzamanlılık sayıları veya zorunlu LOC bütçesi bulunmaz. İlgili konfigürasyon aktif çalışma ortamının ayarlarından alınır.
- **Yürütme ayrımı:** Gauntlet Loop talimat düzeyinde bir iş akışıdır. Ayrıca kurulup test edilmiş bir runtime gate/hook olmadıkça bitişi zorlayan mekanizma olduğu söylenmez; arka planda kendi kendine uyanan bir servis varsayılmaz.

## Harness Detayları

### 1. Codex
- **Subagent çağrısı:** Aktif Codex ortamında mevcutsa `spawn_agent` / collaboration aracıyla ayrı bağlamda reviewer başlat. `fork_turns` destekleniyorsa `none` kullan ve orijinal spec ile kaynakları açıkça ver. Araç yoksa aşağıdaki fallback'i uygula.
- **Kısıtlar:** Reviewer'a salt-okuma ve test çalıştırma yetkisi verilir; dosya yazma veya alt-agent açma kısıtlanır.
- **Çağrı şekli:** Doğrudan `$gauntlet-loop` ile veya kod değişikliği taleplerinde doğal olarak çalışır.

### 2. OMP (Oh My Pi)
- **Subagent çağrısı:** Yerel `task` aracı kullanılır:
  ```json
  {
    "context": "# Orijinal Görev ve Doğrulama Kriterleri\n...",
    "tasks": [
      {
        "agent": "reviewer",
        "solutionSpace": "independent read/test-only review of current diff",
        "task": "İlgili diff'i ve testleri bağımsız incele; STATUS, FAILED CRITERIA, EVIDENCE, REQUIRED CORRECTION formatında dön."
      }
    ]
  }
  ```
- **Rol ve eşzamanlılık:** Mevcut yapılandırılmış `reviewer` rolünü kullanır; eşzamanlılık sınırlarını değiştirmez.
- **Skill erişimi:** `/skill:gauntlet-loop` komutuyla veya `read` aracıyla `skill://gauntlet-loop` üzerinden talimatlar okunur.

### 3. Cursor
- **Subagent ayrımı:** Cursor'ın mevcut bağımsız bağlamlı yerel subagent mekanizması kullanılır.
- **Skill seçimi:** Cursor skill seçiciden `gauntlet-loop` seçilir veya skill etkinse `/gauntlet-loop <görev>` kullanılır. Komut görünmüyorsa ortak `SKILL.md` dosyasını okuyup uygulamasını iste; desteklenmeyen çağrı sözdizimi varsayma.
- **İzolasyon:** Reviewer için ayrı bağlam penceresi açılır; yazarın geçici düşünce zinciri reviewer bağlamına aktarılmaz.

### 4. ChatGPT
- **Çağrı şekli:** Yalnızca ilgili skill veya plugin kurulu ve yetkili olduğunda `@gauntlet-loop` ile çağrılır.
- **Yetenek kısıtları:** ChatGPT ortamında yerel dosya sistemi, yerel terminal testleri veya alt-agent ayrımı yoksa bu yeteneklerin var olduğu varsayılmaz.
- **Eksik yetenek durumu:** Test ve reviewer bağımsızlığı sağlanamıyorsa durum dürüstçe `PARTIAL` / `BLOCKED` olarak raporlanır; kullanıcıya manuel kontrol adımları sunulur.

## İnceleme Yeteneği Bulunmadığında Davranış

Eğer çalışılan harness bağımsız bir reviewer aracı sunmuyorsa:
1. Asla yazarın kendi self-check kontrolünü bağımsız inceleme gibi gösterme.
2. Reviewer sonucunu `BLOCKED` / `PARTIAL` olarak işaretle.
3. Eksik yeteneği adlandır ve Semih'in hızlıca denetleyebileceği bir insan inceleme devri (`Manual Review Handoff`) hazırla.
