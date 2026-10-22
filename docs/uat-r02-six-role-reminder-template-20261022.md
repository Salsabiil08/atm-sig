# UAT R.02 — Reminder, Template, Enam Role (22 Oktober 2026)

## Batas pengujian
- **PASS** berarti skenario otomatis menggunakan fungsi SQL sebenarnya pada database PGlite terisolasi di GitHub Actions. Tidak menggunakan akun, kredensial, atau data Production.
- **BELUM UAT MANUAL** berarti belum ada bukti login dan operasi browser oleh pengguna bisnis keenam role. Tidak ada sign-off.
- Jangan gabungkan PR atau terapkan migration sebelum memeriksa akses riil dan dependency RPC pada lingkungan yang disetujui.

## Reminder dan task otomatis
| ID | Uji | Hasil | Bukti |
|---|---|---|---|
| R-50 | Checkpoint 50%, progres rendah, PIC mendapat notifikasi | PASS simulasi | `scripts/check-reminder-template.mjs` |
| R-80 | Checkpoint 80% | PASS simulasi | SQL fungsi asli |
| R-90 | Checkpoint 90% | PASS simulasi | SQL fungsi asli |
| R-IDEMP | Memanggil checkpoint yang sama lagi tidak menggandakan reminder | PASS simulasi | Unique constraint / assertions |
| T-CREATE | Template mingguan membuat tepat satu task | PASS simulasi | `process_task_template_runs` |
| T-IDEMP | Pemanggilan berikutnya tidak menduplikasi task | PASS simulasi | Task template run |
| T-WIB | Jadwal lanjutan 08.00 WIB minggu berikutnya | PASS simulasi | SQL waktu Asia/Jakarta |
| R-PUSH | Notifikasi baru akan ikut masuk antrean push jika perangkat berlangganan | Kode trigger diverifikasi pada Production; belum dites dengan reminder riil | `enqueue_notification_push_trigger` pada `notifications` |
| R-SCHEDULE | Scheduler `/api/cron/reminders` aktif di Production | **BELUM** | Cron Production saat audit hanya `atm-push-preview-test` untuk `/api/cron/push` |
| R-EMAIL | Email reminder setelah 72 jam | **BELUM** | `RESEND_FROM_EMAIL` belum dikonfigurasi dan uji email riil belum dilakukan |
| T-PROD | Task terbuat otomatis di Production saat pukul 08.00 WIB | **BELUM** | Template aktif lama `Rekonsiliasi`, riwayat `task_template_runs` 0 sebelum pengujian |

## Enam role — simulasi engine
| Role | Skenario otomatis | Hasil | UAT login/browser |
|---|---|---|---|
| Spectator | Tidak dapat membaca task/struktur organisasi/pengguna lain; tidak dapat review/approve | PASS di PGlite (migration Spectator baru) | BELUM |
| Staff/PIC | Buat task untuk diri sendiri, larangan assign orang lain/lintas section, review/approval ditolak | PASS di PGlite | BELUM |
| Manager | Boleh membuat task dalam cakupan dan me-review task PIC; tidak boleh approve deadline | PASS di PGlite | BELUM |
| SM | Me-review task Manager, tolak wajib komentar, menyetujui permintaan deadline | PASS di PGlite | BELUM |
| GM | Me-review task SM, keputusan deadline, dapat self-review tanpa reviewer | PASS di PGlite | BELUM |
| Super Admin | Keputusan deadline dan self-review task tanpa reviewer | PASS di PGlite | BELUM |

Scripts: `scripts/check-r02-db.mjs`, `scripts/check-six-role-workflows.mjs`, `scripts/check-reminder-template.mjs`. CI: lint, TypeScript, unit, database RLS, template/reminder, six-role SQL, build.

## Kondisi Production saat audit read-only
- Supabase Cron hanya job push aktif. Jadi reminder persentase maupun pembuatan task rutin **belum berjalan otomatis**.
- Ada satu template weekly aktif, dengan jadwal lama 21 Oktober 2026 08.00 WIB dan nol riwayat run. Jika scheduler dihidupkan kemudian, missed-run window lebih dari lima menit dicatat `skipped` dan berikutnya dijadwalkan ulang; **tidak retroaktif membuat task yang kelewat**.
- Belum ada akun Spectator aktif di database Production, sehingga role itu tidak dapat diuji end-to-end dengan akun nyata yang tersedia.
- Migrasi P0 SECURITY DEFINER belum diterapkan ke Production (seperti pada audit). Jangan mengubah ACL langsung tanpa UAT negatif dan rollback.

## Rencana uji manual tanpa biaya tambahan
1. Uji Preview memakai akun masing-masing role dan isolasi data: Spectator hanya melihat profil sendiri, tidak melihat task ataupun master bisnis.
2. PIC: buat task pribadi, tetapkan evidence, mulai kerjakan, submit Review; coba assign PIC lain/lintas unit (harus ditolak).
3. Manager: buat/ubah task sesuai scope; review PIC, tolak dengan komentar dan terima; pindah PIC dengan alasan.
4. SM: review task Manager dan approve/tolak deadline, termasuk request usang/duplikat.
5. GM: review SM, self-review task sendiri, cek pembatasan data organisasi.
6. Super Admin: administrasi role, pengecualian self-review, audit log; coba RPC tanpa sesi dan lintas role.
7. Reminder: aktifkan scheduler **setelah persetujuan konfigurasi email dan pemeriksaan secret**, buat task tes yang waktunya singkat dengan WBS, periksa 50/80/90 dalam inbox dan Android, tanpa duplikasi.
8. Task template: buat template tes untuk jadwal terdekat pada hari yang ditentukan, uji satu hasil `created` dan pemanggilan ulang; hapus/pause tes seusai verifikasi.
9. Catat screenshot, aktor, waktu WIB, task ID, log database, dan hasil uji; proses owner menandatangani sign-off.

## Keputusan
**NO-GO untuk merge ke `main` / Production saat ini.** Otomasi CI PASS; UAT manual belum PASS, scheduler reminder belum diaktifkan, dan migration ACL berpotensi mengubah hak RPC internal. Production tetap tidak disentuh.
