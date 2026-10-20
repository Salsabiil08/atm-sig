# 07 — Daftar Layar

Sumber: Blueprint R.01 bagian 8 (Gambar 10–19). Gaya: header merah, sub-menu hitam, tombol hitam, badge status (wireframe SIG). Mockup di PDF adalah acuan **tata letak dan isi**, bukan desain visual final.

| # | Layar | Role utama | Kebutuhan | Gambar |
|---|---|---|---|---|
| 1 | Login | Semua | FR-001, FR-002 | 10 |
| 2 | Master Data Users | Super Admin, GM, SM | FR-004, FR-005 | 11 |
| 3 | Ubah Role User | Super Admin, GM, SM (unitnya) | FR-003, FR-004 | 12 |
| 4 | Dashboard | Manager, SM, GM, Super Admin | FR-070..FR-072 | 13 |
| 5 | Daftar Task | Semua (sesuai cakupan) | FR-029 | 14 |
| 6 | Detail Task (tampilan PIC) | PIC dan atasan | FR-022..FR-028, FR-054 | 15 |
| 7 | Pengajuan Perubahan Deadline | Staff/PIC | FR-060 | 16 |
| 8 | Approval Perubahan Deadline | SM, GM, Super Admin | FR-061, FR-062 | 17 |
| 9 | Review Task | Atasan langsung | FR-040, FR-041 | 18 |
| 10 | Notifikasi | Semua | FR-055, FR-080 | 19 |
| 11 | Kanban | Semua (sesuai cakupan) | FR-110 | `app/(app)/kanban` (mockup T-506 disetujui 2026-10-20) |
| 12 | Timeline Gantt | Semua sesuai cakupan; edit tanggal sesuai role | FR-111 | `app/(app)/timeline` (mockup T-506 disetujui 2026-10-20) |
| 13 | Master Kategori & Template Task | SM, GM, Super Admin (sesuai cakupan) | FR-100, CR-0003 | `app/(app)/task-templates` (mockup T-505 disetujui 2026-10-20) |

Layar yang memerlukan mockup sebelum dikerjakan: Master struktur organisasi, Buat/Edit Task, Pindah Task. Layar Kanban, Timeline Gantt, Master kategori/template, Laporan/Export, dan Audit Log sudah memiliki mockup/referensi yang disetujui.

Mockup konseptual Kanban dan Gantt untuk T-506 tersedia di `docs/mockups/T-506-kanban-timeline.html`; isi kartu menggunakan placeholder dan mockup disetujui pemilik proyek pada 2026-10-20.

Kanban menyediakan enam kolom status, filter section/PIC/prioritas/periode, dan kontrol transisi pada kartu yang hanya ditampilkan untuk PIC berwenang; server tetap memvalidasi transisi, support, evidence, serta review. Timeline menampilkan bar Gantt mulai–tenggat per task dan hitungan task aktif per PIC pada periode, dengan filter bulan/section/PIC. Detail task menjadi jalur perubahan tenggat sesuai role.

Dashboard dan kinerja mengikuti mockup Stitch 04/05: kartu ringkasan, task yang perlu perhatian, serta progress dan beban task aktif per PIC dan unit/section. Seluruh angka berasal dari data server sesuai cakupan role; KPI first-pass/top performer belum menjadi FR pada layar ini.

Implementasi layar 5–6 mengikuti referensi Stitch dengan data dan aksi terscope dari server. Detail task menampilkan WBS, progress dan riwayat, evidence, support, komentar, status, serta riwayat deadline. Tanggapan reminder (FR-054) tetap menjadi pekerjaan M4/T-404; kontrol itu tidak ditampilkan sebelum proses reminder tersedia.

Layar 7–9 mengikuti referensi Stitch: pengajuan deadline tersedia dari detail task untuk PIC, Manager ke atas mendapat kontrol ubah langsung, halaman Approval menampilkan riwayat dalam cakupan organisasi dengan aksi hanya pada pengajuan pending, dan layar Review hanya dapat dibuka reviewer yang ditugaskan atau owner GM/Super Admin tanpa reviewer pada task berstatus Review. Evidence private di layar Review menggunakan signed URL. Owner GM/Super Admin juga dapat langsung menandai Done sesuai BR-022.

Layar 10 menampilkan notifikasi milik akun aktif saja, dengan filter semua/belum dibaca, penanda baca per item maupun massal, tautan task, serta pilihan respons untuk reminder yang belum dijawab. Hasil filter dan pagination dimuat di server; loading, empty, dan error state tersedia dan diumumkan secara aksesibel.
