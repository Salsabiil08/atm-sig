# 08 — Roadmap dan Milestone

Satu milestone aktif pada satu waktu. Milestone berikutnya hanya dimulai bila **exit criteria** terpenuhi (diperiksa oleh pemilik proyek).

| M | Nama | Isi | Exit criteria | FR utama |
|---|---|---|---|---|
| M0 | Fondasi dan keputusan | ADR stack Accepted; kerangka repo; CI (lint + tes); seed roles dan org_units | ADR-0001 Accepted; pipeline hijau; seed 2 unit/7 section terverifikasi | FR-006 |
| M1 | Akses dan organisasi | Login, Spectator default, user dan role management, RBAC server-side, audit log perubahan role | Matriks role lulus uji dari API; S-5 untuk modul ini | FR-001..FR-006, FR-092 (role), NFR-001..003 |
| M2 | Inti task | CRUD task terscope, support, evidence, progress, alur status dan gerbang, daftar dan detail task, pindah task | S-1 dan S-2 lulus; BR-001/002/020/050 teruji | FR-020..FR-031 |
| M3 | Review dan deadline | Review/approve/reject, pengajuan dan approval perubahan deadline, edit langsung | S-6 lulus; BR-021/040/041 teruji | FR-040, FR-041, FR-060..FR-064 |
| M4 | Reminder dan notifikasi | Scheduler, checkpoint 50/80/90, tanggapan PIC, eskalasi ke atasan, in-app + email, halaman notifikasi | S-3 dan S-4 lulus; idempotensi teruji | FR-050..FR-058, FR-080 |
| M5 | Dashboard, laporan, Kanban, dan timeline | Dashboard, laporan, export, tampilan audit log, master template, tampilan Kanban dan timeline (CR-0001) | Angka dashboard cocok dengan data uji; export terverifikasi; Kanban tidak bisa melewati aturan status | FR-070..FR-072, FR-090..FR-092, FR-100, FR-110, FR-111 |
| M6 | Hardening dan UAT | UAT per role, perbaikan, dokumentasi operasional | Semua ukuran S-1..S-6 lulus; blueprint R.01 terpenuhi | semua |

## Urutan tidak boleh dibalik
M4 bergantung pada M2/M3 (status, progress, deadline); M5 bergantung pada data M2–M4. Jangan mengerjakan dashboard atau laporan sebelum data intinya ada.
