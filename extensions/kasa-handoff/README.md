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

- `turn_end`: bir turda araç çalışıp çalışmadığını hatırlar.
- `session_stop`, ana ajan:
  - Kapanış bloğu tamamsa `$KASA_ROOT/handoff/YYYY-MM-DD.md` içindeki
    `<!-- kasa-handoff:auto:begin -->` bloğunu son kayıtla değiştirir. Blok yoksa
    frontmatter'dan sonra ekler. Dosya `KASA_ROOT` altında yoksa hiçbir şey yazmaz.
  - Blok eksikse ve tur araç kullandıysa **tek** gizli devam turu ister; ajan kendi
    cevabını okuyup üç satırı ekler. `stop_hook_active` ikinci turu engeller.
  - Alt ajanlar ve sohbet turları (araç yok) dokunulmaz.
- Kayıt biçimi: `- HH:MM [omp] Yaptım: … | Kanıt: … | Sırada: …`, her alan 240 karakterle sınırlı.
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
