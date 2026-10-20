**Milestone terakhir:** M5 — Dashboard, laporan, Kanban, dan timeline (selesai); M6 — Hardening dan UAT (berjalan)
**WIP limit:** 1 task aktif.

## Task aktif
- **T-601** — UAT per role dan perbaikan — M6
  - Mulai dari checklist UAT `docs/11-uat-checklist.md`; verifikasi manual oleh pemilik proses masih perlu dilakukan pada akun tiap role dan hasilnya dicatat sebelum task ditutup.

## Selesai (M5)
- **T-508** — Tampilan Timeline Gantt — FR-111, BR-081, D-031, D-036 ✓ Selesai 2026-10-20; Gantt terscope dikelompokkan per PIC, filter periode/section/PIC dan jumlah task aktif; PIC hanya mengajukan perubahan tenggat, Manager+ dapat mengubah tanggal mulai dalam cakupan melalui detail task; migration 036 mengaudit dan menjaga tanggal mulai < tenggat; 247 tes suite, lint, typecheck, build lulus; scope ALIGNED, RBAC PASS, rules PASS, data model ALIGNED.
- **T-507** — Tampilan Kanban — FR-110, BR-080, BR-081 ✓ Selesai 2026-10-20; pemilik dan pengelola dalam scope dapat menjalankan transisi standar melalui server, trigger DB, dan UI; Review selalu memakai jalur reviewer/self-review yang meminta komentar saat Revisi; UI Kanban dipoles dan aksesibel; 47 tes API/database, 4 tes UI, 236 tes suite, lint, typecheck, build lulus; scope ALIGNED, RBAC PASS, rules PASS.
- **T-505** — Master kategori dan template task — FR-100, CR-0003, D-032..D-035 ✓ Selesai 2026-10-20; kategori SM/GM/Super Admin terscope, section-only, dan tidak dapat dipindah; template mingguan/bulanan membuat snapshot task idempoten dan melewati slot 08.00 WIB yang terlambat; mockup disetujui; 46 tes API/database terarah, suite 228 tes, lint, typecheck, build; scope ALIGNED, RBAC PASS, data model ALIGNED, rules PASS.
- **T-504** — Tampilan audit log — FR-092 ✓ Selesai; riwayat read-only khusus Manager+, filter aksi/objek/periode, pagination; label aksi lengkap dan tampilan diperbarui.
- **T-503** — Export Excel dan PDF — FR-091 ✓ Selesai; route GET /api/reports/export?format=xlsx|pdf menghasilkan OOXML ZIP dan printable HTML scoped ke filter laporan; terproteksi Manager+; 9 tes export lulus.
- **T-502** — Laporan progres, ketepatan waktu, task terlambat — FR-090, OQ-12 ✓ Selesai; laporan difilter periode/cakupan, rumus ketepatan waktu OQ-12 (Done tepat waktu ÷ seluruh jatuh tempo × 100%, penyebut nol = N/A), ringkasan per unit/section, daftar overdue; 5 tes query lulus.
- **T-501** — Dashboard — FR-070, FR-071, FR-072 ✓ Selesai; ringkasan dan daftar perhatian terscope, agregasi progress aktif per PIC/section; performance route Manager+; 13 tes dashboard/RBAC lulus.

## Selesai (M4 — Reminder dan notifikasi)
- **T-409** — Inbox notifikasi — FR-080 ✓ Selesai; data terscope ke user, filter Semua/Belum dibaca, tandai satu/semua dibaca, respons reminder, pagination dan accessible loading/empty/error states; 7 tes query, 8 tes action/UI, dan 41 tes database lulus.

## Selesai (M0 — Fondasi)
- **T-001** — Putuskan stack teknologi — Selesai 2026-10-18; ADR-0001 Accepted
- **T-002** — Kerangka repo, konvensi, CI — Selesai 2026-10-18
- **T-003** — Migrasi dan seed roles + org_units — Selesai 2026-10-18
- **T-101** — Login dan sesi — FR-001 ✓ Selesai 2026-10-19; D-021 menetapkan Supabase Auth email/password; tes form dan guard sesi lulus
- **T-110** — Pendaftaran mandiri dan pemulihan kata sandi — FR-001a, FR-001b, CR-0002 ✓ Selesai 2026-10-20; konfirmasi email wajib, akun baru Spectator, reset memerlukan tautan recovery valid, redirect callback dibatasi; tes auth terarah lulus
- **T-102** — User baru otomatis Spectator — FR-002, BR-061 ✓ Selesai 2026-10-19; trigger profil diverifikasi dan database menegakkan akses baca saja
- **T-103** — Kelola user: add, edit, aktif/nonaktif — FR-005 ✓ Selesai 2026-10-19; Auth Admin invitations dengan kredensial server-only, penempatan awal mengikuti inviter, edit nama, sinkronisasi ban/status, audit log, middleware menolak akun nonaktif; 25 tes lulus
- **T-104** — Penetapan role dan penempatan (satu role per user) — FR-003, BR-060 ✓ Selesai; Super Admin-only assignment, validasi level organisasi dan rantai atasan aktif, audit log dan rollback jika audit gagal; tes unit dan RLS API lulus
- **T-105** — Usulan perubahan role oleh GM dan guard kewenangan — FR-004, D-024 ✓ Selesai; GM dapat mengusulkan assignment tervalidasi pada cakupannya, hanya Super Admin dapat menyetujui/menolak, keputusan dan perubahan tercatat di audit log; 42 tes lulus
- **T-106** — Middleware RBAC dan filter cakupan organisasi — NFR-001, NFR-002, PR-1, PR-2 ✓ Selesai; route Dashboard/Users dibatasi role, query task menerapkan scope, RLS hierarchical untuk task dan entitas terkait; Manager/SM lintas section/unit ditolak; 48 tes lulus
- **T-107** — Audit log perubahan role — NFR-003, FR-092 ✓ Selesai; perubahan role dan keputusan proposal dicatat; direct authenticated update profil dan mutasi audit log ditolak; 51 tes lulus
- **T-108** — Uji matriks role lewat API — S-5 ✓ Selesai; delapan role/scope diuji untuk baca, update, dan create; cakupan Spectator diperbaiki agar meliputi penempatan beserta turunannya; 15 tes database lulus
- **T-109** — Layar Login, Master Data Users, Ubah Role — FR-001..FR-005 ✓ Selesai; alur login dan role management disesuaikan ke referensi, dialog undangan/role dan tabel responsive, 3 tes komponen lulus
- **T-201** — Model task dan CRUD terscope — FR-020, FR-021 ✓ Selesai; validasi input, action create/update/delete dengan audit server-side, delete RLS hanya Manager+ dalam scope, 9 tes baru dan 64 tes suite lulus
- **T-202** — Support yang dibutuhkan — FR-022, BR-002 ✓ Selesai; owner membuat permintaan ke penerima aktif, hanya penerima dapat menyelesaikan sekali; data tampil pada query detail task; 5 tes action dan 2 tes RLS/API lulus
- **T-203** — Evidence wajib dan unggah evidence — FR-023, FR-024, NFR-005 ✓ Selesai; syarat evidence disimpan saat task dibuat, file/link tervalidasi, bucket privat, akses scope dan signed URL; 83 tes seluruh suite lulus, lint/typecheck/build lulus
- **T-204** — Update progress % — FR-025, BR-010 ✓ Selesai; PIC dapat memperbarui angka bulat 0–100, histori immutable tercatat via database trigger dan terscope; action dan RLS/API diuji
- **T-205** — Mesin status dan transisi sah — FR-026, BR-001 ✓ Selesai; state machine dijaga action dan DB trigger untuk transisi/aktor, serta `completed_at` konsisten; 12 unit dan 22 API/database tests lulus
- **T-206** — Gerbang Blocked dan gerbang Review — FR-027, FR-028, BR-002, BR-020 ✓ Selesai; API dan DB menolak Blocked tanpa support pending, pemulihan sebelum support diberikan, dan Review/Done tanpa evidence wajib; GM/SA owner dikecualikan sesuai BR-022; 41 tes terarah lulus
- **T-207** — Pindah task dan riwayat — FR-030, FR-031, BR-050, BR-051 ✓ Selesai; transfer atomik via RPC dengan validasi role/pohon organisasi, supervisor baru, riwayat immutable, notifikasi PIC baru, API bypass ditutup; 4 unit action dan 27 tes API/database lulus
- **T-208** — Daftar task dengan filter — FR-029 ✓ Selesai; section/PIC/status/prioritas/search/periode overlap diproses server-side dan selalu digabung dengan scope akses; 5 tes filter lulus
- **T-209** — Layar Daftar Task dan Detail Task (PIC) — docs/07 #5–#6 ✓ Selesai; filter section/PIC memakai pilihan nama, detail ter-scope responsif mencakup WBS, progress dan riwayat, evidence private dengan signed download, support, komentar, status, serta riwayat deadline; kontrol mengikuti role dan state; 2 tes UI serta 120 tes seluruh suite lulus
- **T-210** — Notifikasi task baru ke PIC — FR-020 ✓ Selesai; trigger `AFTER INSERT` menyimpan tepat satu notifikasi `task_assigned` untuk PIC dalam transaksi yang sama; tes API/RLS membuktikan pembuat tidak menerima notifikasi itu dan notifikasi pemindahan T-207 tetap terpisah; 28 tes database lulus
- **T-301** — Rantai reviewer dan review — FR-040, BR-070, D-015 ✓ Selesai; aksi create/update dan trigger DB memastikan reviewer adalah atasan langsung aktif dengan role level tepat; task PIC GM/Super Admin wajib tanpa reviewer; 5 tes unit, 9 tes action, dan 29 tes API/database lulus
- **T-302** — Approve → Done, Reject → Revisi + komentar — FR-041, BR-021 ✓ Selesai; action review memanggil RPC transaksional yang menyimpan komentar reviewer sebelum transisi; trigger DB menolak Revisi tanpa komentar reviewer dari transaksi yang sama; audit log dan 41 tes action/API database lulus
- **T-303** — Pengajuan perubahan deadline oleh PIC — FR-060, BR-040 ✓ Selesai; action dan trigger DB memvalidasi PIC aktif sebagai pemilik, tanggal future, dan alasan; request tetap pending dan deadline task lama tidak berubah; 6 tes action serta 31 tes API/database lulus
- **T-304** — Approval/penolakan perubahan deadline — FR-061, FR-062 ✓ Selesai; RPC transaksional mengizinkan SM/GM/Super Admin dalam scope, memeriksa request pending dan deadline tidak stale, lalu mengubah status/approver/waktu dan deadline; update langsung request ditutup; 3 tes action dan 35 tes database lulus
- **T-305** — Edit deadline langsung oleh role berwenang — FR-064, BR-041 ✓ Selesai; trigger DB memvalidasi role aktif, scope, tanggal future/setelah start, dan menulis audit secara atomik; PIC ditolak saat mencoba update langsung; 7 tes action dan 35 tes database lulus
- **T-306** — Layar Pengajuan, Approval, Review Task — docs/07 #7–#9 ✓ Selesai; modal pengajuan deadline pada detail task, daftar approval terscope dengan histori dan aksi pending, serta layar review dengan akses signed evidence; 8 tes UI dan 7 tes query lulus
- **T-307** — Perlakuan task tanpa reviewer (GM/Super Admin) — BR-022, D-015, D-019 ✓ Selesai; GM/Super Admin dapat menyelesaikan langsung atau self-review melalui RPC, komentar wajib saat self-reject, tanpa reviewer/evidence wajib; diuji pada UI dan API/database.
- **T-401** — Perhitungan waktu berjalan (jam tiruan, uji tepi) — FR-050, BR-030/030a ✓ Selesai; durasi ≥24 jam memakai timestamp absolut; task <24 jam mengukur pekerjaan dari bobot leaf WBS selesai dan gate checkpoint; task tanpa leaf berbobot tidak diberi reminder; 8 tes waktu batas lulus. OQ-03 diputuskan pemilik.
- **T-402** — Scheduler checkpoint 50/80/90 dan idempotensi — FR-051, FR-052, FR-058, BR-037, D-017 ✓ Selesai; Supabase Cron memanggil endpoint server-only terautentikasi; RPC SQL membuat reminder dan notifikasi PIC atomik dengan unique key per checkpoint/versi deadline; Blocked/Review tetap eligible, Done/overdue dikecualikan; 1 tes database scheduler dan 4 tes endpoint lulus.
- **T-403** — Reminder hanya ke PIC — FR-053, BR-033 ✓ Selesai; semua reminder scheduler diarahkan ke owner task dan trigger database menolak notifikasi reminder untuk user lain atau task tanpa PIC; 2 tes database reminder lulus.
- **T-404** — Tanggapan PIC pada reminder — FR-054, BR-034 ✓ Selesai; aksi memvalidasi pilihan dan identitas PIC, menyimpan tanggapan sekali dengan timestamp DB, RLS membatasi update ke PIC, trigger menolak pilihan invalid/overwrite; 4 tes aksi dan 1 tes database lulus.
- **T-405** — Notifikasi atasan setelah respons/progres — FR-055, BR-035 ✓ Selesai; trigger transaksi mengabari reviewer langsung, SM unit, GM, Super Admin untuk respons/progres; pengajuan tenggat hanya SM/GM/Super Admin; keputusan dikirim ke PIC; 39 tes database lulus.
- **T-406** — Kanal in-app dan email — FR-056, ADR-0001 ✓ Selesai; in-app dipersist melalui trigger scheduler/event; Resend hanya mengirim email reminder belum dijawab setelah 72 jam, tidak untuk task Done/overdue; claim lease 15 menit, retry aman dengan idempotency key, konfigurasi server-only; 9 tes route/provider dan 1 tes database lulus.
- **T-407** — Penanda Lewat dan suppression reminder — FR-057, BR-036 ✓ Selesai; `Lewat` dihitung dari timestamp absolut pada dashboard/list/detail dan tidak mengubah enum status; checkpoint/email menolak task Done atau deadline tercapai; 2 tes helper dan 2 tes database lulus.
- **T-408** — Versi checkpoint setelah perubahan deadline — FR-063, BR-038, OQ-09 ✓ Selesai; scheduler memakai `due_date` sebagai `due_date_version` dan unique key per versi; persetujuan deadline memicu checkpoint yang sama lagi pada tanggal baru tanpa menghapus versi lama; 1 tes database end-to-end lulus.

## Aturan mengganti task aktif
1. Task sebelumnya memenuhi `docs/09-definition-of-done.md`.
2. Pindahkan ke "Selesai" di `tasks/BACKLOG.md`.
3. Salin task berikutnya (urutan backlog) ke sini. Jangan melompat milestone.
