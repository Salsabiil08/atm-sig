# Audit 24 Oktober 2026 — roadmap implementasi ATM R.03

Sumber: audit read-only yang dikirim pemilik proyek. Jangan dianggap sebagai bukti UAT.

## Fase 1 — Navigasi aman (PR #7)
- [x] Lima menu utama role-aware: Dashboard, Pekerjaan, Persetujuan, Laporan, Master Data dalam empat grup.
- [x] Tugas Saya dengan filter owner server-side; Daftar Task, Kanban, Timeline sebagai tab.
- [x] Dashboard Ringkasan/Kinerja & Job Load sebagai tab.
- [x] Inbox reviewer khusus assigned reviewer; Approval Deadline sebagai tab untuk SM+.
- [x] Pengguna & Role bersama Kategori & Template sebagai tab; Laporan bersama Audit Log sebagai tab.
- [x] Notifikasi berupa lonceng header + jumlah unread dengan fallback ketika query gagal.
- [x] URL lama dipertahankan, backend RPC & aturan RLS tidak berubah.
- [ ] UAT interaktif di HP/desktop dan sign-off enam role; jangan klaim PASS sebelum bukti.

## Fase 2 — Jobload historis (BELUM)
Audit mendapati buildDashboardPerformance/getActiveTaskWorkloads mengecualikan Done. Menghitung job historis tidak aman dengan menghapus filter karena perlu status as-of cut-off, completed_at, reassignment history dan WIB.
Persetujuan definisi: task unik yang masuk periode, carry-over, baru, selesai, terbuka, overdue, completion rate. Jangan hitung dengan menjumlah snapshot harian. Test reassignment, Done, cross-month, backdated completion, cut-off WIB dan cakupan RLS sebelum rilis.

## Fase 3 — Workflow PIC (BELUM)
Kategori, WBS, support awal pada pembuatan; editor WBS dan progress; Edit/Hapus dengan konfirmasi dan server actions; review/evidence dalam detail task. Periksa kompatibilitas schema dan hak akses sebelum menambah kontrol UI.

## Fase 4 — Master, laporan, efisiensi (BELUM)
CRUD organisasi terotorisasi, export PDF asli, agregasi/pagination dashboard, filter perhatian sebelum limit, tab Pending/Riwayat approval, revisi send-time email 72 jam sesuai keputusan bisnis.

## Matriks UAT manual wajib
| ID | Peran | Uji | Hasil yang diharapkan |
|---|---|---|---|
| UAT-N01 | Spectator | Sidebar + /tasks?mine=1 | Hanya Pekerjaan, tak bisa review/approve |
| UAT-N02 | PIC | Tugas Saya, semua tab Pekerjaan | Owner hanya sendiri, bookmark lama bekerja |
| UAT-N03 | Manager | Review inbox | Hanya task assigned, tak ada Approval Deadline |
| UAT-N04 | SM | Review dan Approval Deadline | Scope sesuai reviewer/unit |
| UAT-N05 | GM/Admin | Self-review yang diizinkan, report/audit/master | Guard server tetap berlaku |
| UAT-N06 | Semua role | Lonceng dan inbox | Jumlah unread sesuai akun; query gagal tak memblokir workspace |
| UAT-N07 | Semua role | Tema Light/Dark, Android/desktop | Tab dan header responsif, tak overflow |
| UAT-N08 | Semua role | Direct URL lama | Tautan lama dan RBAC server tetap berjalan |

Automated SQL six-role regression bukan UAT browser; dokumentasikan screenshot, role, timestamp WIB, task ID dan sign-off sebelum release Production.
