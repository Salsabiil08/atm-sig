# ATM SIG R.03 — Audit, implementasi, risiko, dan UAT (24 Oktober 2026)

**Repository:** Salsabiil08/atm-sig · **PR:** #7 (draft) · **Branch:** feat/audit-navigation-workflows-20261024.

## Implementasi yang selesai di SOURCE CODE
1. **Navigasi:** lima menu utama, ikon SVG di sebelah kiri, tab role-aware, Tugas Saya, Review Inbox, notification bell, URL lama tetap hidup.
2. **Jobload:** laporan bulanan WIB, carry-over, task baru, selesai, outstanding, overdue dan tingkat penyelesaian. Untuk periode dengan data lifecycle cukup, dihitung dari event status, kepemilikan, tanggal mulai dan tenggat (bukan status saat ini). Data yang tidak cukup diberi label *ESTIMASI*, bukan disamakan dengan data historis pasti.
3. **PIC dan WBS:** kategori terbatasi section, WBS root/sub-item maksimal dua tingkat dengan total bobot leaf 100% saat pembuatan, initial support opsional, evidence, dan satu RPC `create_task_bundle_r03` dengan rollback atomik jika salah satu bagian gagal. Update WBS/checkbox dan progress memakai RPC transaksional. Form detail menyediakan WBS dua tingkat dan akses kontrol server.
4. **Struktur organisasi:** CRUD untuk Super Admin, SM/GM read-only. Hirarki Department→Unit→Section, pencegahan reparent berbahaya serta FK, audit org pada trigger dalam transaksi, pencabutan hak TRUNCATE/REFERENCES/TRIGGER untuk peran web.
5. **Laporan dan performa:** PDF biner sesungguhnya, report Excel tetap ada, Pending/Riwayat approval, dashboard filter periode, daftar task perhatian tidak lagi dibatasi 50 sebelum evaluasi, pagination untuk metrik.

## Migrasi baru — BELUM diterapkan pada Production
Jangan merge aplikasi sebelum migrasi berikut siap dan terverifikasi pada lingkungan SQL:
- `supabase/migrations/20261024202000_r03_task_bundle_and_org_guard.sql`: atomik create task + WBS/support, constraint hierarki org/WBS, guard bobot, audit org.
- `supabase/migrations/20261024203000_r03_task_state_event_history.sql`: baseline dan event status/PIC/tanggal, RLS baca sesuai task.
- `supabase/migrations/20261024204000_r03_atomic_wbs_progress.sql`: RPC add/toggle WBS dan progress dalam satu transaksi.

Migrasi tidak menambahkan data contoh atau menghapus task Production. Urutan harus 02000→03000→04000. Snapshot database terlebih dahulu. Jangan mengaktifkan aplikasi yang memanggil RPC baru ketika fungsi belum diterapkan.

## VALIDASI OTOMATIS
- GitHub Actions: ESLint, TypeScript, Vitest, SQL regression R.02, role UAT terisolasi, migration R.03 PGlite, dan build Next.js.
- PGlite R.03 memeriksa role grants, create bundle berhasil, WBS bertingkat, rollback bila total bobot/support/parent salah, org hierarchy dan audit, serta perubahan WBS/progress.
- Unit Jobload memeriksa task Done, carry-over, perpindahan PIC, reopen, baseline yang terlambat, dan cutoff WIB.

**Penting:** tes database di PGlite bukan bukti alur browser, lingkungan Supabase Production atau UAT manusia sudah lulus. Status final mengikuti commit HEAD dan verifikasi ulang setelah perubahan apa pun.

## MATRIKS UAT BISNIS MANUAL — BELUM ADA SIGN-OFF
| ID | Role | Skenario | Expected |
|---|---|---|---|
| UAT-R03-01 | Spectator | Buka Dashboard/Master/Approvals langsung | Ditolak server sesuai RBAC |
| UAT-R03-02 | PIC | Buat task kategori, dua tingkat WBS bobot 100%, support dan evidence | Satu task + seluruh child tercipta, audit terlihat |
| UAT-R03-03 | PIC | Coba WBS 90%, parent tidak valid, support ke diri sendiri | Semua ditolak, tidak ada task/sisa child |
| UAT-R03-04 | PIC | Centang leaf WBS lalu uji gagal update | WBS dan progress konsisten, tanpa partial commit |
| UAT-R03-05 | Manager | Review assigned task, edit/delete dalam cakupan | Audit dan hak server terjaga |
| UAT-R03-06 | SM | Approval deadline dan master org | Baca master, tidak boleh CRUD org |
| UAT-R03-07 | GM | Jobload/reports lintas unit sesuai RLS | Tidak ada kebocoran scope |
| UAT-R03-08 | Super Admin | Tambah/edit/hapus org, uji parent salah, unit digunakan, rollback audit | Hirarki terjaga, semua perubahan tercatat |
| UAT-R03-09 | Manager+ | Jobload Oktober lama dan periode sesudah baseline | Data sebelum provenance ditandai estimasi; setelah lengkap dinyatakan terlacak |
| UAT-R03-10 | Manager+ | Report PDF, Excel, >1000 task | PDF valid, data lengkap dalam cakupan |
| UAT-R03-11 | Semua role | Light/Dark, Android/desktop, ikon, tab, notifikasi | Responsif, kontras terbaca |
| UAT-R03-12 | Semua role | Push, reminder, audit task lama, cron, template | Tidak regresi |

Catat role, waktu WIB, ID task, screenshot, hasil aktual, status PASS/FAIL, dan pemberi sign-off.

## KETERBATASAN YANG TIDAK DAPAT DIHILANGKAN SECARA RETROAKTIF
- **Histori sebelum baseline migrasi tidak pernah dicatat sebagai event lengkap.** Data lama hanya estimasi berdasarkan snapshot/current known reassignment. Tidak boleh merekonstruksi status atau owner dengan menebak.
- Cakupan Jobload berdasarkan izin baca role saat ini, bukan snapshot struktur organisasi historis. Task yang dihapus tidak dapat dipulihkan dari tabel task aktif.
- Total penugasan per PIC tidak sama dengan total task unik departemen karena task yang pindah PIC menyumbang kepada lebih dari satu PIC.
- Nama PIC historis mungkin tidak tersedia bila pengguna tidak lagi terlihat menurut RLS.
- PDF aktual, email reminder 72 jam, dan browser enam role tetap perlu validasi pengguna.
- CRUD org berubah hanya untuk Super Admin; user/task yang sudah mereferensikan unit membatasi pemindahan jenis atau penghapusan.

## GATE RILIS PRODUCTION
1. Semua CI dan Vercel Preview untuk commit HEAD sama-sama sukses.
2. Snapshot/backup database dipastikan valid.
3. Ketiga SQL migrasi dipasang berurutan dan dicek grant/RLS/trigger; jangan menggunakan service_role dari browser.
4. UAT real enam role, aplikasi mobile/desktop, PDF dan Jobload bisnis disetujui.
5. Merge PR #7 setelah pemilik aplikasi menyetujui Production; verifikasi Vercel menggunakan commit merged.
6. Bila gagal: hentikan rilis aplikasi/revert deploy; jangan menghapus data atau memotong migrasi secara manual tanpa peninjauan.

**Saat file ini ditulis: semua perubahan masih di PR draft, Production belum berubah.**
