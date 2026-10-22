# Çoklu Worker ve İş Akışları (Workstreams)

Büyük ve birden çok parçadan oluşan işlerde, Gauntlet Loop paralel workstream'lerle ölçeklenebilir. Bu doküman, orijinal Gauntlet tasarımındaki iş bölme ve Herdr orkestrasyon detaylarını korur.

## İş Bölme İlkeleri (Decomposition)

- **Gerçek Bağımsızlık:** Yalnızca birbirine bağımlı olmayan ve farklı dosyalara/modüllere dokunan işler paralelleştirilir.
- **Yapay Rollerden Kaçınma:** Aynı dosyaya aynı anda bakan "senior frontend", "junior dev", "UI polish" gibi yapay unvan ayrıştırmaları paralel workstream değildir.
- **Yazma İzolasyonu (Write Isolation):** İki paralel worker asla aynı çalışma ağacına (working tree) eşzamanlı yazmamalıdır. Çakışma riski varsa:
  - Ayrı git worktree veya branch kullan,
  - Ya da işleri sıralı (sequential) yürüt.

## Worker Görev Sözleşmesi

Orchestrator tarafından açılan her worker aşağıdaki kanonik blokla sınırlandırılır:

```text
OUTCOME:    <tek somut sonuç>
SOURCE:     <kesin worktree, branch, dosyalar, referans veya doküman bölümü>
CONSTRAINT: <kapsam sınırları + must-preserve kuralları + alt-agent açma yok + push/deploy yok>
CHECK:      <en dar ilgili doğrulama ve beklenen başarı kanıtı>
```

Worker'ın görevi tamamladığını iddia etmesi kanıt değildir; her worker kendi `CHECK` adımını çalıştırıp ham çıktıyı teslim etmelidir.

## İnteraktif Ortamlarda Orkestrasyon (Herdr / Tmux)

Gelişmiş yerel orkestrasyon ortamlarında (örn. Herdr) oturum yaşam döngüsü şu şekilde yönetilir:

1. **Yerleşim:** `herdr_layout` -> `pane_split` (caller tab + cwd) ile yeni pane açılır; pane adı görevi yansıtmalıdır (`worker-mobile-layout`, `verify-results` vb.).
2. **Başlatma ve Bekleme:** `herdr_agent start` (tekil isim, kind, pane) -> `prompt` + `wait` (timeout verilir; settlement beklenir, polling yapılmaz).
3. **Çıktı Toplama:** Büyük log ve terminal çıktıları repoyu kirletmemek için repo dışı bir yola (`/tmp/...`) yazdırılıp oradan okunur.
4. **Kapasite ve Limitler:** Aktif harness'ın güncel yapılandırmasını ve araç desteğini doğrula; ortak skill'de sabit agent sayısı veya eski Herdr API desteği varsayma.
5. **Kapatma:** Yalnız bu iş için bizzat açtığın worker oturumlarını, kanıt alındıktan sonra yerel sahiplik kurallarına göre kapat. Semih'in veya başka bir işin oturumlarına dokunma.

## Entegrasyon

Bütün workstream'ler kendi bağımsız doğrulamasından geçtikten sonra:
1. Değişiklikler tek bir entegrasyon sahibi tarafından birleştirilir.
2. Olası çakışmalar çözülür ve birleşik diff gözden geçirilir.
3. Proje seviyesindeki genel kontroller (full build, regression testleri) çalıştırılır.
4. Nihai birleşik artifact üzerinde sistem düzeyinde final doğrulama yapılır.
