# Backlog (urut pengerjaan)

Format: `T-id` — judul — ID terkait. Centang bila selesai (sesuai DoD).

## M0 — Fondasi dan keputusan
- [x] T-001 — Putuskan stack (ADR-0001 Accepted) — OQ-01 ✓ Selesai 2026-10-18
- [x] T-002 — Kerangka repo, konvensi, CI lint dan tes — NFR-001 ✓ Selesai 2026-10-18
- [x] T-003 — Migrasi dan seed: roles (6) dan org_units (department, 2 unit, 7 section) — FR-006 ✓ Selesai 2026-10-18

## M1 — Akses dan organisasi
- [x] T-101 — Login dan sesi — FR-001 ✓ Selesai 2026-10-19
- [x] T-102 — User baru otomatis Spectator — FR-002, BR-061 ✓ Selesai 2026-10-19
- [x] T-103 — Kelola user: add, edit, aktif/nonaktif — FR-005 ✓ Selesai 2026-10-19
- [x] T-104 — Penetapan role dan penempatan (satu role per user) — FR-003, BR-060 ✓ Selesai; validasi satu role/penempatan dan atasan aktif sesuai hierarki; hanya Super Admin dapat menetapkan langsung
- [x] T-105 — Usulan perubahan role oleh GM dan guard kewenangan — FR-004, D-024 ✓ Selesai; GM mengusulkan pada cakupannya, assignment divalidasi dan hanya Super Admin yang dapat memutuskan
- [x] T-106 — Middleware RBAC dan filter cakupan organisasi — NFR-001, NFR-002, PR-1, PR-2 ✓ Selesai; role gate middleware, filter scope server-side, RLS hierarkis dan tes batas Manager/SM lintas organisasi
- [x] T-107 — Audit log perubahan role — NFR-003, FR-092 ✓ Selesai; semua assignment/perubahan profil dan keputusan proposal tercatat; mutasi profil/audit log direct API diblokir
- [x] T-108 — Uji matriks role lewat API — S-5 ✓ Selesai; matriks delapan role/scope memverifikasi baca, update, create dan penolakan API langsung
- [x] T-109 — Layar Login, Master Data Users, Ubah Role — docs/07 #1–#3 ✓ Selesai; user list, filter, invite dialog, assignment modal, dan navigasi responsif; 3 tes komponen lulus
- [x] T-110 — Pendaftaran mandiri dan pemulihan kata sandi — FR-001a, FR-001b, CR-0002 ✓ Selesai; signup wajib konfirmasi email, semua akun baru Spectator, reset hanya melalui token recovery, callback dibatasi, tes auth terarah lulus

## M2 — Inti task
- [x] T-201 — Model task dan CRUD terscope — FR-020, FR-021 ✓ Selesai; create/read/update/delete, validasi, auditing via service client, RLS delete per scope; typecheck/build lulus
- [x] T-202 — Support yang dibutuhkan — FR-022, BR-002 ✓ Selesai; permintaan owner-only, penerima aktif/non-self, transisi status satu arah dan immutable, detail query serta API RLS diuji
- [x] T-203 — Evidence wajib dan unggah evidence — FR-023, FR-024, NFR-005 ✓ Selesai; persyaratan tersimpan saat task dibuat, unggah/link tervalidasi, bucket privat dan unduhan signed URL; 8 tes action dan 19 tes database lulus
- [x] T-204 — Update progress % — FR-025, BR-010 ✓ Selesai; hanya PIC mengubah progress 0–100, histori disimpan otomatis dan dapat dibaca sesuai scope; 6 action dan 1 database test lulus
- [x] T-205 — Mesin status dan transisi sah — FR-026, BR-001 ✓ Selesai; transisi resmi dipakai server-side dan ditegakkan trigger database, reviewer/PIC disaring, `completed_at` dikelola server; 12 unit dan 22 API/database tests lulus
- [x] T-206 — Gerbang Blocked dan gerbang Review — FR-027, FR-028, BR-002, BR-020 ✓ Selesai; Blocked butuh support pending, kembali ke In progress hanya setelah support diberikan, Review/Done butuh evidence wajib kecuali owner GM/SA; API trigger dan action diuji (41 tes terarah)
- [x] T-207 — Pindah task dan riwayat — FR-030, FR-031, BR-050, BR-051 ✓ Selesai; manager/SM/GM/Super Admin dibatasi level dan pohon org, PIC dipindah atomik bersama reviewer dan riwayat, PIC baru dinotifikasi; API bypass ditolak
- [x] T-208 — Daftar task dengan filter — FR-029 ✓ Selesai; query menerapkan scope role ditambah section/PIC/status/prioritas/pencarian/periode overlap, validasi filter dan pagination; 5 tes query lulus
- [x] T-209 — Layar Daftar Task dan Detail Task (PIC) — docs/07 #5–#6 ✓ Selesai; filter daftar memakai pilihan nama PIC/section dan prioritas, detail scoped memuat WBS, progress/riwayat, evidence dengan signed download, support, komentar, dan riwayat deadline; action dibatasi ke PIC/penerima/reviewer sesuai state; 2 tes UI dan seluruh 120 tes suite lulus
- [x] T-210 — Notifikasi task baru ke PIC — FR-020 ✓ Selesai; trigger database mengirim satu notifikasi ke PIC pada INSERT task sehingga pembuatan task dan notifikasi bersifat atomik dan tidak bergantung pada jalur aplikasi; tes RLS/API membuktikan penerima dan tidak ada notifikasi ke pembuat

## M3 — Review dan deadline
- [x] T-301 — Rantai reviewer dan review — FR-040, BR-070 (GM dan Super Admin tanpa reviewer, D-015) ✓ Selesai; reviewer tervalidasi sebagai atasan aktif pada rantai role dan ditegakkan trigger database; GM/Super Admin tidak memiliki reviewer
- [x] T-302 — Approve → Done, Reject → Revisi + komentar — FR-041, BR-021 ✓ Selesai; RPC review memutuskan Done/Revisi dan menyimpan komentar reviewer secara atomik; penolakan tanpa komentar diblokir trigger database; action dan audit trail teruji
- [x] T-303 — Pengajuan perubahan deadline oleh PIC — FR-060, BR-040 ✓ Selesai; action memvalidasi PIC, tanggal future, dan alasan 1–1000 karakter; trigger/RLS database memastikan hanya PIC aktif pemilik task dapat mengajukan dan deadline task tetap tidak berubah; 6 tes action dan 31 tes API/database lulus
- [x] T-304 — Approval/penolakan oleh SM/GM/Super Admin — FR-061, FR-062 ✓ Selesai; RPC atomik memeriksa role/scope, status pending, dan deadline stale; update langsung request dicabut; 3 tes action dan 35 tes database lulus
- [x] T-305 — Edit deadline langsung oleh role berwenang — FR-064, BR-041 ✓ Selesai; trigger DB memvalidasi role aktif, scope, tanggal, dan audit secara atomik; PIC tidak dapat melewati approval via API; 7 tes action dan 35 tes database lulus
- [x] T-306 — Layar Pengajuan, Approval, Review Task — docs/07 #7–#9 ✓ Selesai; UI mengikuti Stitch untuk modal deadline, approval scoped beserta histori, dan review/evidence; 8 tes UI serta 7 tes query lulus
- [x] T-307 — Perlakuan task tanpa reviewer (GM/Super Admin) — BR-022, D-015, D-019 ✓ Selesai; owner dapat langsung Done atau self-review melalui RPC dengan komentar wajib saat Revisi, tanpa reviewer dan tanpa gerbang evidence wajib; UI/API/database diuji.

## M4 — Reminder dan notifikasi
- [x] T-401 — Perhitungan waktu berjalan (jam tiruan, uji tepi) — FR-050, BR-030 ✓ Selesai; ≥24 jam memakai timestamp absolut; <24 jam memakai gate progres leaf WBS berbobot yang selesai; tanpa WBS berbobot tidak diingatkan; 8 tes waktu batas lulus (OQ-03 diputuskan)
- [x] T-402 — Scheduler checkpoint 50/80/90 dan idempotensi — FR-051, FR-052, FR-058, BR-037, D-017 ✓ Selesai; Supabase Cron → endpoint CRON_SECRET → RPC transaksional; unik per task/checkpoint/deadline; PIC saja; menguji Blocked/Review, short-task WBS, Done, overdue, pengulangan, serta kegagalan endpoint.
- [x] T-403 — Reminder hanya ke PIC — FR-053, BR-033 ✓ Selesai; scheduler hanya menargetkan owner_id dan trigger database menghalangi pengiriman reminder ke user lain; tested dengan injeksi notifikasi salah PIC.
- [x] T-404 — Tanggapan PIC — FR-054, BR-034 ✓ Selesai; tiga pilihan divalidasi, hanya PIC task dapat menjawab sekali, database memberi timestamp server dan menolak nilai invalid/overwrite; 4 tes action dan 1 tes API/database.
- [x] T-405 — Notifikasi ke Manager, SM, GM, Super Admin — FR-055, BR-035 ✓ Selesai; response/progress ke reviewer langsung + SM unit + GM/SA; request deadline ke SM/GM/SA; approval decision ke PIC; in-app notifications dibuat dalam transaksi; 39 tes database lulus.
- [x] T-406 — Kanal in-app dan email — FR-056 ✓ Selesai; Resend server-only untuk reminder tanpa respons setelah 72 jam; database claim lease 15 menit, status sent idempoten, retry provider memakai idempotency key; task Done/overdue dikecualikan; 9 tes route/provider + 1 tes database.
- [x] T-407 — Penanda Lewat — FR-057, BR-036 ✓ Selesai; helper timestamp bersama digunakan dashboard/task list/detail, task Done dikecualikan; scheduler dan email mengabaikan task di/delapan tenggat; 2 tes helper + 2 tes database.
- [x] T-408 — Hitung ulang checkpoint setelah deadline berubah — FR-063, BR-038 ✓ Selesai; update deadline oleh RPC persetujuan memulai versi baru berdasarkan `due_date`, riwayat lama tidak dihapus, checkpoint yang sama dapat dibuat ulang sekali; 1 tes database end-to-end lulus.
- [x] T-409 — Layar Notifikasi — FR-080 ✓ Selesai; inbox scoped per user dengan filter Semua/Belum dibaca, tandai satu/semua dibaca, aksi respons reminder, pagination, loading/empty/error state yang aksesibel; 7 tes query, 8 tes action/UI, dan 41 tes database lulus.

## M5 — Dashboard, laporan, Kanban, dan timeline
- [x] T-501 — Dashboard — FR-070, FR-071, FR-072 ✓ Selesai; ringkasan dan daftar perhatian terscope, agregasi progress aktif per PIC/section dengan data waktu yang dapat diuji; performance route Manager+; 13 tes dashboard/RBAC lulus.
- [x] T-502 — Laporan progres, ketepatan waktu, task terlambat — FR-090 (OQ-12) ✓ Selesai; rumus ketepatan waktu OQ-12, ringkasan per unit/section, daftar overdue, filter periode dan cakupan; 5 tes lulus
- [x] T-503 — Export Excel dan PDF — FR-091 ✓ Selesai; route GET /api/reports/export?format=xlsx|pdf; OOXML ZIP tanpa dependensi luar; 9 tes lulus
- [x] T-504 — Tampilan audit log — FR-092; read-only untuk Manager+, filter aksi/objek/periode dan pagination; daftar filter meliputi seluruh aksi audit dan UI dipoles.
- [x] T-505 — Master kategori dan template task — FR-100, CR-0003, D-032..D-035; kategori section-only dan immutable dengan akses API terscope, scheduler mingguan/bulanan idempoten melewatkan window 08.00 WIB yang terlambat, snapshot task mandiri; 46 tes API/database terarah dan 228 tes suite, lint, typecheck, build lulus 2026-10-20
- [x] T-506 — Mockup Kanban dan timeline, disetujui pemilik sebelum dibangun — FR-110, FR-111, CR-0001, OQ-14; Gantt dan jumlah task aktif per PIC diputuskan (D-031), mockup Gantt/Kanban disetujui 2026-10-20
- [x] T-507 — Tampilan Kanban (pemindahan kartu tunduk BR-001/002/020/021) — FR-110, BR-080, BR-081; role berwenang dalam scope dapat membuat transisi standar, Review memakai jalur reviewer/self-review; status, support, evidence, scope tetap ditegakkan action/RLS/trigger; 4 tes UI, direct API tests, 236 tes suite, lint, typecheck, build lulus 2026-10-20
- [x] T-508 — Tampilan Timeline (mulai–tenggat, beban kerja per orang; PIC ubah tenggat → pengajuan) — FR-111, BR-081, D-031, D-036; Gantt terscope, filter dan beban aktif per PIC, kontrol Manager+ untuk start date dan PIC melalui pengajuan due date; 247 tes, lint, typecheck, build lulus; scope ALIGNED, RBAC PASS, rules PASS, data model ALIGNED ✓ Selesai 2026-10-20

## M6 — Hardening dan UAT
- [ ] T-601 — UAT per role dan perbaikan — checklist tersedia di `docs/11-uat-checklist.md`; menunggu eksekusi manual dan pencatatan hasil oleh pemilik proses
- [ ] T-602 — Verifikasi ukuran keberhasilan S-1..S-6
- [ ] T-603 — Dokumentasi operasional

## Selesai
- [x] T-001 — Putuskan stack (ADR-0001 Accepted) — OQ-01 | Selesai 2026-10-18; keputusan: Next.js 16/TypeScript, Vercel, PostgreSQL di Supabase, Supabase Auth/Storage/Cron, Resend
- [x] T-002 — Kerangka repo, konvensi, CI lint dan tes | Selesai 2026-10-18; struktur folder, middleware, RBAC helper, Supabase client, layout sidebar
- [x] T-003 — Migrasi dan seed roles + org_units | Selesai 2026-10-18; 3 file migration SQL di supabase/migrations/
- [x] T-101 — Login dan sesi — FR-001 | Selesai 2026-10-19; Supabase Auth email/password, redirect sesi, penanganan error, 6 tes otomatis, build produksi lulus (D-021)
- [x] T-102 — User baru otomatis Spectator — FR-002, BR-061 | Selesai 2026-10-19; trigger profil Spectator diverifikasi dan RLS mencegah Spectator mengubah profil, task, atau notifikasi; 3 tes database lulus
- [x] T-103 — Kelola user: add, edit, aktif/nonaktif — FR-005 | Selesai 2026-10-19; undangan Auth server-side, edit nama, aktivasi/nonaktivasi Auth + profil, cakupan SM, audit log, middleware account-status guard, 25 tes lulus
- [x] T-104 — Penetapan role dan penempatan (satu role per user) — FR-003, BR-060 | Selesai; Super Admin-only assignment, validasi level organisasi dan rantai atasan aktif, audit log serta rollback jika audit gagal; tes unit dan RLS API lulus
- [x] T-105 — Usulan perubahan role oleh GM dan guard kewenangan — FR-004, D-024 | Selesai; tabel usulan dengan satu pending per target, validasi ulang saat disetujui, keputusan Super Admin, audit, UI antrean dan tes RLS/server action
- [x] T-106 — Middleware RBAC dan filter cakupan organisasi — NFR-001, NFR-002, PR-1, PR-2 | Selesai; guard Dashboard/Users, filter query task, RLS scope Manager/SM per section/unit termasuk entitas task, tes API langsung
- [x] T-107 — Audit log perubahan role — NFR-003, FR-092 | Selesai; audit assignment, proposal dan keputusan; authenticated client tidak dapat bypass audit; 51 tes lulus
- [x] T-101 — Login dan sesi — FR-001 | Selesai 2026-10-19; Supabase Auth email/password, redirect sesi, penanganan error, 6 tes otomatis, build produksi lulus (D-021)
