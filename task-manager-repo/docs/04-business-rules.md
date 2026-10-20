# 04 — Aturan Bisnis

Sumber: Blueprint R.01 bagian 3.1, 6 dan decision log. Tanda **(turunan)** = penjabaran teknis yang belum tertulis eksplisit di blueprint; perlu konfirmasi bila ragu.

## Status task (BR-001..BR-002)
Status resmi: `To do`, `In progress`, `Blocked`, `Review`, `Revisi`, `Done`.

| Dari | Ke | Syarat |
|---|---|---|
| To do | In progress | PIC mulai mengerjakan |
| In progress | Blocked | **BR-002** wajib mengisi support yang dibutuhkan |
| Blocked | In progress | Support diberikan |
| In progress | Review | **BR-020** semua evidence wajib sudah terunggah |
| Review | Done | **BR-021** disetujui atasan langsung |
| In progress / Review | Done | Hanya untuk task milik GM/Super Admin, oleh pemilik sendiri (**BR-022**) |
| Review | Revisi | Ditolak reviewer; komentar wajib |
| Revisi | In progress | PIC memperbaiki |

Transisi lain ditolak oleh sistem.

**BR-002 Support:** PIC task membuat permintaan dengan deskripsi dan penerima aktif yang berbeda dari dirinya. Hanya penerima yang dapat mengubah status `diminta` menjadi `diberikan`, satu kali; isi dan penerima permintaan tidak dapat diubah setelah dibuat. Akses permintaan mengikuti akses task induknya.

## Progress (BR-010)
PIC memperbarui `progress_pct` (0–100). Progress dipakai oleh checkpoint 50%.

## Evidence (BR-020)
Evidence wajib ditentukan saat task dibuat. Status `Review` tidak dapat dipilih sebelum **semua** evidence wajib terunggah (kecuali task milik GM/Super Admin, BR-022). Pengajuan yang tidak lengkap ditolak sistem dan PIC diminta melengkapi.

## Review (BR-021, BR-070)
- Rantai review: Manager → Staff/PIC, SM → Manager, GM → SM.
- Approve → `Done`. Reject → `Revisi` dengan komentar wajib; task kembali ke `In progress`.
- Keputusan reviewer dan komentar penolakan disimpan secara atomik; API langsung tidak dapat mengubah status ke `Revisi` tanpa komentar reviewer pada transaksi yang sama.
- Task milik GM dan Super Admin **tidak memiliki reviewer** (D-015).
- **BR-022** Pemilik task GM/Super Admin bebas: boleh langsung menandai `Done` atau me-review hasil pekerjaannya sendiri (D-019). Sistem tidak mewajibkan reviewer dan, sebagai turunan dari "bebas", gerbang evidence BR-020 tidak memblokir task milik mereka; evidence tetap dapat diunggah.

## Reminder berbasis persentase (BR-030..BR-038)
- **BR-030** (timeline ≥ 24 jam) `elapsed_pct = (sekarang − tanggal_mulai) / (tenggat − tanggal_mulai) × 100` menggunakan timestamp absolut; timezone Asia/Jakarta hanya untuk tampilan. Contoh: tenggat 24 jam → checkpoint jam ke-12 (50%), 19,2 (80%), 21,6 (90%).
- **BR-030a** Timeline kurang dari 24 jam: checkpoint waktu tetap dihitung dari elapsed time, sedangkan kemajuan pekerjaan dihitung dari bobot leaf WBS yang selesai dibagi total bobot leaf WBS. Pada tiap checkpoint 50/80/90, kirim reminder hanya bila persentase pekerjaan selesai masih di bawah checkpoint tersebut. Tanpa WBS leaf berbobot, task pendek tidak menghasilkan reminder.
- **BR-031** Checkpoint 50%: kirim reminder jika `progress_pct < 50`.
- **BR-032** Checkpoint 80% dan 90%: kirim reminder jika task belum `Done`, **termasuk** status `Blocked`, `Review`, dan `Revisi` (D-017).
- **BR-033** Reminder **hanya** ke PIC yang bersangkutan.
- **BR-034** PIC menanggapi dengan salah satu pilihan: masih on progress, butuh support, atau ajukan perubahan deadline. Tanggapan disimpan dengan waktu respons dan hanya dapat dicatat satu kali untuk setiap reminder; pengajuan tenggat tetap memerlukan tanggal dan alasan melalui alur perubahan deadline.
- **BR-035** Notifikasi ke atasan saat PIC menanggapi reminder atau memperbarui progress: Manager (section), SM (unit), GM, Super Admin. Notifikasi pengajuan perubahan deadline: SM, GM, Super Admin. Keputusan approval: PIC pengaju.
- **BR-036** Task non-Done dengan `due_date` yang telah tercapai ditandai `Lewat` pada dashboard dan daftar/detail task (status ini turunan timestamp, bukan status task baru), tanpa reminder in-app atau email tambahan.
- **BR-037 (turunan)** Setiap checkpoint dikirim paling banyak satu kali per task per versi deadline (idempoten; scheduler yang jalan ulang tidak boleh mengirim ganda).
- **BR-038** Setelah perubahan deadline disetujui, checkpoint dihitung ulang dari deadline baru. Tenggat baru membentuk versi checkpoint baru; versi lama tetap disimpan, dan checkpoint yang sama boleh dikirim ulang satu kali pada versi baru (OQ-09, D-028).
- Kanal: in-app dan email.

## Perubahan deadline (BR-040..BR-042)
- **BR-040** Staff/PIC mengajukan deadline baru + alasan → status pengajuan `Menunggu approval` → SM, GM, atau Super Admin menyetujui/menolak. Deadline lama tetap berlaku sampai disetujui.
- **BR-041** Manager, SM, GM, Super Admin mengubah deadline langsung (CRUD).
- **BR-042** Pengajuan, keputusan, approver, dan waktu keputusan tercatat (tabel pengajuan dan audit log).

## Kanban dan Timeline (BR-080..BR-081, CR-0001)
- **BR-080** Kolom Kanban = enam status resmi. Semua role yang berhak mengubah task (Staff/PIC, Manager, SM, GM, Super Admin) boleh memindahkan kartu dalam cakupan task masing-masing (D-020); Spectator hanya melihat. Setiap pemindahan tetap tunduk pada BR-001, BR-002, BR-020, BR-021 dan BR-022 (transisi tidak sah ditolak dengan pesan).
- **BR-081** Staff/PIC yang mengganti tenggat dari Kanban/timeline hanya membuat pengajuan (BR-040), bukan perubahan langsung; PIC juga tidak dapat mengubah `start_date` secara langsung. Form pengajuan yang tersedia hanya untuk tenggat (`due_date`). Manager, SM, GM, dan Super Admin dapat mengubah start date dalam cakupan task (D-036) serta mengubah tenggat langsung (BR-041).

## Kategori dan template task rutin (FR-100, CR-0003)
- SM dapat mengelola kategori dan template dalam unitnya; GM dan Super Admin lintas unit (D-032).
- Template aktif membuat task mandiri sesuai jadwal mingguan/bulanan pukul 08.00 WIB. Jadwal terlewat dilewati tanpa susulan; eksekusi ulang tidak menggandakan task.
- Task memakai PIC, reviewer, kategori, prioritas, dan offset tanggal mulai/tenggat pada template. Task yang sudah dibuat tidak berubah saat template diedit atau dinonaktifkan (D-034).

## Pemindahan task (BR-050..BR-051)
- **BR-050** Cakupan pemindahan mengikuti `docs/03-roles-and-permissions.md`; alasan wajib.
- **BR-051** Riwayat dari siapa, ke siapa, kapan, alasan tersimpan; PIC baru dinotifikasi.

## Pengguna dan role (BR-060..BR-061)
- **BR-060** Satu user hanya satu role dan satu penempatan unit/section.
- **BR-061** User yang pertama kali login otomatis `Spectator` (view only).
