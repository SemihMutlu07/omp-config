# kasa-handoff

Tur kapanışını kalıcı hale getiren OMP eklentisi. `AGENTS.md` içindeki "Turn close"
kuralı her iş turunun üç satırla bitmesini ister:

```
Yaptım: <ne değişti>
Kanıt: <komut, dosya veya çıktı>
Sırada: <sonraki adım; iş bittiyse yok>
```

Bu eklenti o satırları oturum dışına taşır. Kasa bağlamı oturum başında
`handoff/YYYY-MM-DD.md` dosyasının ilk 1500 baytını zaten enjekte eder; bu yüzden
kayıt dosyanın **başına**, frontmatter'dan hemen sonra işaretli bir blok olarak yazılır.

## Davranış

- `turn_end`: araç kullanımını koşu boyunca tutar. Son tur metinse bayrak silinmez.
- `session_stop`, ana ajan:
  - Kapanış bloğu tamamsa `$KASA_ROOT/handoff/YYYY-MM-DD.md` içindeki
    `<!-- kasa-handoff:auto:begin -->` bloğunun başına son kaydı ekler. Blok yoksa
    frontmatter'dan sonra ekler. Dosya `KASA_ROOT` altında yoksa hiçbir şey yazmaz.
  - Blok eksikse ve koşu araç kullandıysa **tek** gizli devam turu ister. Son turun
    araçsız olması bu isteği düşürmez. `stop_hook_active` ikinci turu engeller.
  - **Sırada kapısı**: yalnız araç kullanan koşuda çalışır. `Sırada` satırı sahibini
    söylemek zorundadır. Kabul: `yok`, `varsayılan: …`, cihaz/kimlik işi, veya
    `Sonraki turda …`. Bunların hiçbiri yoksa tur `decision: "block"` ile bir kez
    geri gider. Sohbet turu bloklanmaz.
  - Onarım sayacı `agent_start` ile silinmez. Yeni kullanıcı girişi siler.
  - Alt ajanlar dokunulmaz.
- Kayıt biçimi: `- HH:MM [omp] Yaptım: … | Kanıt: … | Sırada: …`, her alan 240 karakterle sınırlı.
  Satır en çok 450 bayttır. Satır sığmazsa önce `Yaptım` ve `Kanıt` kısalır. `Sırada` en çok 200 bayt korunur.
- Blok **birikir**: en yeni satır üstte, toplam 1000 bayta kadar. Sığmayan eski kapanış
  satırları düşer. En yeni satır hiç düşmez.
- `input` (yalnız ana ajan, oturum başına bir kez): kullanıcının ilk gerçek isteğini
  (`/` ve `!` ile başlamayan) `- HH:MM [omp] Niyet: "…"` satırı olarak yazar, 160 karakterle sınırlı.
  En yeni 2 niyet satırı kapanış satırlarından sonra düşer. Böylece sonraki oturum yalnız son
  turun nasıl bittiğini değil, ne istendiğini de görür.
- Yazma atomiktir (aynı dizinde geçici dosya + `rename`). Aynı kayıt ikinci kez
  geldiğinde dosya değişmez.

## Claude Code

`scripts/claude-kasa-handoff.py` aynı sözleşmeyi Claude Code Stop kancası olarak uygular:
son asistan mesajını transkriptten okur, bloğu yazar; blok yoksa ve tur araç
kullandıysa `{"decision":"block","reason":…}` ile tek devam turu ister.

## Sınırlar

- Blok yalnız bugünün devir dosyasına yazılır; geçmiş günler değişmez.
- Kasa yoksa veya `handoff/` dizini yoksa sessizce atlar.
- Eklenti yeni oturumda yüklenir; açık oturumlar değişikliği almaz.

## Kontroller

```bash
bun test ./extensions/kasa-handoff/test-kasa-handoff.ts
python3 tests/test_agents_neutrality.py
```

## Concurrent writers

`writeLine` and `scripts/claude-kasa-handoff.py` take the same `handoff/.kasa-handoff.lock` directory lock around read-modify-write. Two sessions closing a turn together keep both lines. A lock older than 10 s is broken. A lock held longer than 3 s is skipped so a turn never hangs.
