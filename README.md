# OMP Config & Multi-Machine Setup

Bu depo, **OMP (oh-my-pi)** geliştirici ortamı, model rolleri, retry zincirleri, kurallar (`AGENTS.md`), özel yetenekler (skills) ve eklentileri (extensions) cihazlar arasında (özellikle dizüstü `omarchy` ve masaüstü `omarchy-1`) tutarlı ve güvenli şekilde senkronize etmek için oluşturulmuştur.

---

## 🏗 Mimari ve Durum Ayrımı (State Separation)

Çok makineli mimaride SQLite kilitlenmelerini (`SQLITE_CORRUPT`) ve kimlik sızıntılarını engellemek için **katı bir durum ayrımı** uygulanır:

| Kategori | Yönetim Yolu | Git Takibi |
|---|---|---|
| **Konfigürasyon (`config.yml`, `settings.json`)** | Bu Git reposu + Sembolik Link | **Evet** |
| **Kurallar (`AGENTS.md`)** | Bu Git reposu + Sembolik Link | **Evet** |
| **Yetenekler (`skills/*`)** | `~/.pi/agent/skills/` | **Evet** |
| **Eklentiler (`extensions/*`)** | `~/.omp/agent/extensions/` | **Evet** |
| **Model Kimlik Bilgileri (`auth.json`, Token'lar)** | Host-yerel (`omp login` / env) | ❌ **ASLA (Gitignore)** |
| **SQLite Veritabanları (`*.db`, `*.db-wal`)** | Host-yerel çalışma kayıtları | ❌ **ASLA (Gitignore)** |
| **Oturum Geçmişleri (`sessions/`, `logs/`)** | Cihaz-yerel loglar | ❌ **ASLA (Gitignore)** |

> **UYARI:** `~/.omp/agent/*.db` veritabanları Syncthing veya Git ile cihazlar arasında senkronize edilmemelidir. Eşzamanlı yazma durumunda veritabanı bozulması meydana gelir.

---

## 🚀 Yeni Cihazda (Masaüstü) Hızlı Kurulum

### 1. Repoyu Klonlayın
```bash
git clone git@github.com:SemihMutlu07/omp-config.git ~/dev/omp-config
cd ~/dev/omp-config
```

### 2. Kurulum Script'ini Çalıştırın
```bash
./setup.sh
```
Varsayılan olarak sembolik link (`symlink`) oluşturur. Bu sayede repoda çekilen (`git pull`) veya düzenlenen değişiklikler doğrudan OMP tarafından anında algılanır.

### 3. OMP Binary Kontrolü (Mise ile)
Eğer masaüstünde `omp` yüklü değilse, `~/.config/mise/config.toml` dosyasına şu satırı ekleyin:
```toml
[tools]
oh-my-pi = { version = "18.4.9", rename_exe = "omp" }
```
Ardından:
```bash
mise install
```

### 4. Sağlayıcı Girişleri (Authentication)
Yeni cihazda model sağlayıcılarını bağlayın:
```bash
omp login
```
* **Google Antigravity:** Gemini 3.8 Flash, Claude Sonnet 4.6
* **OpenAI Codex:** GPT-6 Astra, GPT-6 Luna, GPT-6.1 Sol
* **Cursor:** Grok 4.7, Claude Sonnet 5.5, Claude Opus 5.5

---

## 📁 Dosya ve Dizin Haritası

```
omp-config/
├── .gitignore              # Gizli anahtarlar, veritabanları ve oturum loglarını engeller
├── setup.sh                # Otomatik sembolik link ve dizin kurulum script'i
├── README.md               # Bu dokümantasyon
├── config.yml              # Ana OMP konfigürasyonu (model rolleri, retry zincirleri, tui vb.)
├── settings.json           # observational-memory ve alt sistem ayarları
├── AGENTS.md               # OMP global sözleşmesi ve kullanıcı kuralları
├── extensions/             # OMP eklentileri
│   ├── deepseek-offpeak.ts # DeepSeek tarife penceresi takipçisi
│   ├── herdr-omp-agent-state.ts # Herdr orkestrasyon entegrasyonu
│   ├── bash-guard/         # Bash komut güvenlik filtresi
│   ├── observational-memory/ # Çok katmanlı gözlemsel bellek sistemi
│   └── prompt-snippets/    # Hızlı komut ve snippet kütüphanesi
└── skills/                 # Pi & OMP özel yetenekleri (22 adet)
    ├── analyze-sessions/
    ├── brainstorm-yanci/
    ├── brutal-product-strategist/
    ├── clarity/
    ├── delegate-wave/
    ├── diagnose-crash/
    ├── find-skills/
    ├── gauntlet-loop/
    ├── graphify/
    ├── grill-me/
    ├── grilling/
    ├── herdr/
    ├── humanizer/
    ├── napiyorduk/
    ├── omarchy/
    ├── pdf-reader/
    ├── ste100/
    ├── transitions-dev/
    ├── wayfinder/
    ├── web-debug/
    ├── workers-best-practices/
    └── youtube-transcript/
```

---

## 🔄 Cihazlar Arasında Güncelleme Akışı

1. **Laptop'ta yeni bir skill veya config ayarı yaptığınızda:**
   ```bash
   cd ~/dev/omp-config
   git add -A
   git commit -m "feat(skills): add new-skill"
   git push
   ```
2. **Desktop'a geçtiğinizde:**
   ```bash
   cd ~/dev/omp-config
   git pull
   ```
   Sembolik linkler kurulu olduğu için OMP hiçbir dosya kopyalama gerektirmeden güncel konfigürasyonu kullanır.
