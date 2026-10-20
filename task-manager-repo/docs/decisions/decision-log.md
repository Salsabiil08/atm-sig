# Decision Log

Keputusan yang **sudah dikonfirmasi pemilik proyek**. Agent tidak boleh mengubah entri; perubahan hanya lewat Change Request dan entri baru yang menggantikan.

| ID | Tanggal | Keputusan | Sumber |
|---|---|---|---|
| D-001 | 2026-10-14 | Super Admin memiliki semua akses (termasuk CRUD, pindah task, ubah role, approval deadline) | Percakapan + Blueprint 5 |
| D-002 | 2026-10-14 | GM me-review task SM; SM me-review task Manager; Manager me-review Staff/PIC | Percakapan + Blueprint 3.2.6 |
| D-003 | 2026-10-14 | Manager mendapat notifikasi tenggat/progress staff | Percakapan |
| D-004 | 2026-10-14 | Reminder berbasis persentase waktu (50%, 80%, 90%), bukan hari; hanya ke PIC | Blueprint 3.1 |
| D-005 | 2026-10-14 | Persentase dihitung dari waktu berjalan antara tanggal mulai dan tenggat; PIC mengisi progress dalam persen | Blueprint 3.1 |
| D-006 | 2026-10-14 | Reminder 80% dan 90% dikirim selama task belum Done, tanpa melihat progress; 50% hanya jika progress < 50% | Blueprint 3.1 |
| D-007 | 2026-10-14 | Tanggapan dan progress PIC dinotifikasikan ke Manager, SM, GM, Super Admin | Blueprint 3.1 |
| D-008 | 2026-10-14 | PIC boleh mengajukan perubahan deadline; berlaku setelah disetujui SM/GM/Super Admin; Manager/SM/GM/Super Admin mengubah langsung | Blueprint 6.4 |
| D-009 | 2026-10-14 | Setelah lewat tenggat, task ditandai Lewat tanpa reminder tambahan | Blueprint 6.3 |
| D-010 | 2026-10-14 | Satu user satu role; user baru otomatis Spectator | Blueprint 3.2.1 |
| D-011 | 2026-10-14 | Unit Reporting punya 2 manager; Unit Accounting 5 manager | Blueprint 5 |
| D-012 | 2026-10-14 | SM mengubah role hanya di unit/departemennya; GM dan Super Admin semua role | Blueprint 5 |
| D-013 | 2026-10-14 | Notifikasi lewat in-app dan email | Blueprint 3.1 |
| D-014 | 2026-10-16 | Blueprint R.01 (PDF) menjadi sumber kebenaran utama proyek | Percakapan |
| D-015 | 2026-10-16 | Task milik GM dan Super Admin **tidak memiliki reviewer** | Percakapan 2026-10-16 (jawaban OQ-02) |
| D-016 | 2026-10-16 | Untuk timeline kurang dari 1 hari, checkpoint dihitung dari **pekerjaan yang sudah terselesaikan** (nanti dikonversi ke persentase). Rumus rinci menyusul (OQ-03) | Percakapan 2026-10-16 (jawaban OQ-03) |
| D-017 | 2026-10-16 | Status Blocked dan Review dihitung "belum Done": reminder 80% dan 90% tetap dikirim | Percakapan 2026-10-16 (jawaban OQ-04) |
| D-018 | 2026-10-16 | Tampilan Kanban dan timeline **masuk scope** (CR-0001); blueprint perlu dinaikkan ke R.02 | Percakapan 2026-10-16 (jawaban OQ-06) |
| D-019 | 2026-10-16 | Pemilik task GM dan Super Admin bebas: boleh langsung menandai Done atau me-review hasil pekerjaannya sendiri; sistem tidak mewajibkan reviewer | Percakapan 2026-10-16 (jawaban OQ-13) |
| D-020 | 2026-10-16 | Kanban: kolom mengikuti enam status blueprint; semua role yang berhak mengubah task boleh memindahkan kartu dalam cakupannya. Staff/PIC yang mengganti deadline atau timeline (termasuk dari Kanban/timeline) tetap harus diizinkan SM/GM/Super Admin | Percakapan 2026-10-16 (jawaban OQ-14) |
| D-021 | 2026-10-19 | Login menggunakan email dan kata sandi melalui Supabase Auth (FR-001). Pendaftaran mandiri dengan konfirmasi email dan reset kata sandi melalui tautan tervalidasi ditambahkan melalui persetujuan CR-0002 (FR-001a/b); bootstrap Super Admin tetap terpisah. | Jawaban pemilik proyek atas OQ-08 dan persetujuan CR-0002 |
| D-023 | 2026-10-19 | Untuk T-103, Super Admin, GM, dan SM dapat mengelola user; SM dibatasi pada unitnya, sedangkan GM dan Super Admin lintas unit. Undangan menggunakan Auth Admin API dengan kredensial server-only; user undangan tetap Spectator dan mengikuti penempatan unit inviter. Aktivasi undangan boleh mengatur kata sandi pertama. Pendaftaran mandiri dan reset password kini diizinkan oleh CR-0002; bootstrap Super Admin tetap di luar persetujuan. | Amandemen terbatas CR-0002, persetujuan CR-0002, dan jawaban pemilik proyek |
| D-024 | 2026-10-19 | Untuk penetapan role/penempatan (T-104/T-105), hanya Super Admin yang menetapkan langsung. GM dapat mengajukan usulan untuk diproses Super Admin; SM tidak dapat menetapkan role langsung. Keputusan ini menggantikan aturan kewenangan sebelumnya pada FR-004 dan matriks role. | Jawaban pemilik proyek atas konflik FR-004/OQ-11 |
| D-025 | 2026-10-19 | Usulan perubahan role memiliki status pending/approved/rejected dan satu usulan pending per target. GM hanya dapat mengusulkan perubahan untuk user dalam cakupannya; validasi assignment dijalankan saat pengajuan dan diulang saat Super Admin menyetujui. Penolakan tidak mengubah profil target dan keputusan dicatat di audit log. | Implementasi T-105 untuk FR-004 dan D-024 |
| D-026 | 2026-10-19 | Profil user tidak dapat diubah langsung oleh authenticated client, termasuk Super Admin. Perubahan role, penempatan, dan status hanya dilakukan melalui Server Actions yang memiliki audit log dan rollback kompensasi jika pencatatan gagal; insert/update/delete audit log ditolak melalui Supabase API. | Implementasi T-107 untuk NFR-003 dan FR-092 |
| D-027 | 2026-10-20 | Notifikasi in-app untuk task baru dibuat oleh trigger `AFTER INSERT` dalam transaksi yang sama agar semua jalur pembuatan task memberi notifikasi tepat satu kali kepada PIC; notifikasi reassignment tetap menjadi event terpisah. | Implementasi T-210 untuk FR-020 |
| D-028 | 2026-10-19 | Task berdurasi <24 jam memakai persentase WBS leaf berbobot yang selesai; reminder dipicu pada elapsed 50/80/90% hanya jika progres pekerjaan masih di bawah checkpoint. Timestamp selalu absolut; Asia/Jakarta hanya untuk tampilan. Deadline yang disetujui memulai versi checkpoint baru tanpa menghapus histori versi lama. | Jawaban pemilik proyek atas OQ-03 dan OQ-09 |
| D-029 | 2026-10-19 | Reminder dijadwalkan oleh satu Supabase Cron tiap lima menit melalui endpoint server-only ber-`CRON_SECRET`. Pemrosesan checkpoint dan notifikasi PIC bersifat transaksional/idempoten berdasarkan task, checkpoint, dan versi deadline. | Implementasi T-402 untuk BR-030..BR-038 |
| D-030 | 2026-10-18 | Laporan ketepatan waktu menghitung task Done pada/sebelum tenggat efektif dibagi semua task yang tenggatnya jatuh dalam periode; task belum Done setelah tenggat tetap menjadi penyebut, task dibatalkan dikecualikan, tenggat saat penyelesaian menjadi acuan, dan penyebut nol ditampilkan N/A. | Jawaban pemilik proyek atas OQ-12, FR-090 |
| D-031 | 2026-10-20 | Mockup timeline memakai Gantt dan beban kerja per orang ditampilkan sebagai jumlah task aktif pada periode terfilter. | Jawaban pemilik proyek atas OQ-14 |
| D-032 | 2026-10-20 | Pengelolaan kategori dan template task tersedia untuk SM, GM, dan Super Admin; SM dibatasi pada unitnya, GM dan Super Admin lintas unit. | Jawaban pemilik proyek atas T-505 |
| D-033 | 2026-10-20 | CR-0003 disetujui: template task rutin boleh membuat task secara otomatis berkala; rincian operasional scheduler ditetapkan sebelum implementasi scheduler. | Persetujuan eksplisit pemilik proyek atas CR-0003 |
| D-034 | 2026-10-20 | Task template berjalan mingguan atau bulanan pada pukul 08.00 WIB. Jadwal terlewat dilewati tanpa susulan; perubahan template hanya berlaku untuk task berikutnya. PIC, reviewer, dan offset tanggal mulai/tenggat diwariskan dari template. | Jawaban pemilik proyek atas OQ-16 |
| D-035 | 2026-10-20 | Jadwal bulanan pada tanggal 29, 30, atau 31 dijalankan pada hari terakhir bulan jika tanggal pilihan tidak tersedia pada bulan tersebut. | Jawaban pemilik proyek atas mockup T-505/OQ-16 |
| D-036 | 2026-10-20 | PIC tidak dapat mengubah `start_date` secara langsung; form pengajuan yang ada tetap hanya untuk tenggat (`due_date`). Perubahan start date hanya dapat dilakukan role Manager+ dalam cakupan task. | Jawaban pemilik proyek atas OQ-17, FR-111/BR-081 |
| D-037 | 2026-10-20 | Pendaftaran mandiri terbuka untuk alamat email apa pun, wajib konfirmasi email, dan semua akun baru otomatis Spectator. Permintaan reset password selalu memberi respons generik dan hanya token recovery valid yang dapat mengubah password. Callback autentikasi hanya menerima tujuan internal yang ditentukan aplikasi. | Persetujuan eksplisit pemilik proyek atas CR-0002 |
