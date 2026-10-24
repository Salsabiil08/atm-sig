# ATM R.03 — Audit dan status implementasi 24 Oktober 2026
PR #7, branch feat/audit-navigation-workflows-20261024. Audit pengguna merupakan dasar rencana, bukan sign-off.

## Tahap 1 — Navigasi
IMPLEMENTED: sidebar lima menu dalam empat grup, tab pekerjaan (Tugas Saya, Daftar, Kanban, Timeline), Dashboard, Persetujuan, Laporan/Audit, Master. Review Inbox dan lonceng notifikasi. Ikon SVG mandiri di sebelah kiri semua menu utama dan tab, tanpa dependensi eksternal.
PENDING: UAT browser seluruh role.

## Tahap 2 — Jobload
IMPLEMENTED: Jobload bulanan WIB; total penugasan, carry-over, task baru, selesai, outstanding, overdue dan completion rate. Termasuk task Done dan riwayat reassignment yang tersedia, diuji secara unit.
LIMITATION: RLS berdasarkan cakupan user saat ini, bukan snapshot historis organisasi; reopened task, PIC historis tanpa nama yang terlihat, atau riwayat status hilang belum dapat direkonstruksi sepenuhnya. Total lintas PIC dapat menghitung task pindahan satu kali untuk masing-masing PIC; tidak boleh disamakan dengan jumlah task unik departemen.

## Tahap 3 — PIC Workflow
IMPLEMENTED: kategori scope saat create task, support awal opsional bagi PIC, penambahan dan checklist WBS datar di detail, Edit title/priority dan Hapus konfirmasi untuk Manager+, navigasi anchor tahapan detail.
LIMITATION: support awal disimpan setelah task dibuat (tidak atomik). Bila support gagal, task tetap ada; jangan retry pembuatan task. WBS hierarkis dan WBS langsung dalam transaksi create belum diimplementasikan.

## Tahap 4 — Master, Report, Performance
IMPLEMENTED: struktur organisasi read-only untuk SM+, Pending/Riwayat Approval, PDF biner asli dan XLSX, scan metrics dashboard paginated dan task perhatian sebelum limit, filter bulan tenggat Dashboard.
LIMITATION: CRUD struktur organisasi memerlukan transaksi audit atomik dan validasi hirarki sebelum aman. Dashboard filter berdasarkan jatuh tempo; Jobload berdasarkan rentang kepemilikan/assignment. Pengiriman email reminder tetap perlu verifikasi bisnis.

## UAT MANUAL yang WAJIB sebelum release (belum diklaim PASS)
| ID | Role | Skenario dan target |
|---|---|---|
| NAV-01 | Spectator | Tidak dapat mengakses admin, melihat task sebatas RLS |
| NAV-02 | PIC | Tugas Saya, create kategori, support awal, editor WBS, evidence, review |
| NAV-03 | Manager | Review Inbox hanya task assigned, Edit/Hapus dengan audit; dilarang approve deadline |
| NAV-04 | SM | Approval Pending/Riwayat sesuai cakupan unit |
| NAV-05 | GM | Multi-unit reports, self-review bila dibolehkan |
| NAV-06 | Super Admin | Review master/user/org & audit |
| NAV-07 | Semua role | Bell notification, tema Light/Dark, layout mobile/desktop, URL lama |
| KPI-01 | Manager+ | Jobload: task Done, carry-over, reassignment, overdue, cutoff WIB |
| KPI-02 | Manager+ | Filter Dashboard: semua metrik relevan dalam periode tenggat |
| PDF-01 | Manager+ | PDF benar-benar dapat dibuka di viewer, sesuai XLSX; akses di luar role ditolak |
| PERF-01 | Manager+ | >1000 task, pagination tidak memotong data |
| REG-01 | Semua role | Reminder, push Android, template, task status, audit tidak regresi |

## Release gates
1. SHA HEAD final harus lint/typecheck/unit/SQL regression/build SUCCESS.
2. Vercel Preview SHA final READY.
3. Browser UAT enam role, screenshoot + task ID + timestamp WIB dan sign-off.
4. Verifikasi PDF dengan data aktual serta angka Jobload historis bersama pemilik proses.
5. PR draft hingga rilis disetujui. Production tetap commit sebelum PR #7.

## Update 24 Oktober — navigasi berikon
- [x] Ikon menu Dashboard, Pekerjaan, Persetujuan, Laporan, Master Data
- [x] Ikon tab workspaces, ukuran tetap dan decorative aria-hidden
- [x] Unit tests untuk role gating, active state, dan aksesibilitas ikon
- [ ] UAT visual ukuran mobile 320/375/430 px dan desktop, mode Light/Dark, login dengan semua role
