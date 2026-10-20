# 02 — Kebutuhan (Requirements)

Setiap ID harus muncul di `docs/traceability.md` dan di commit/PR yang mengimplementasikannya. **Acceptance criteria** (AC) menjadi dasar tes.
Kolom Asal: `B` = tertulis di blueprint, `C` = Change Request disetujui, `D` = turunan teknis (perlu konfirmasi bila bertentangan).

## Akses dan pengguna
| ID | Kebutuhan | AC | Asal |
|---|---|---|---|
| FR-001 | Login ke aplikasi | Kredensial valid → masuk; tidak valid → ditolak | B |
| FR-001a | Pendaftaran akun mandiri | Email dan kata sandi valid → email konfirmasi dikirim; akun baru berstatus Spectator dan belum dapat masuk sebelum email dikonfirmasi | C (CR-0002) |
| FR-001b | Reset kata sandi | Permintaan mengirim tautan ke email tanpa mengungkap apakah alamat terdaftar; kata sandi hanya dapat diubah melalui tautan reset valid | C (CR-0002) |
| FR-002 | User baru otomatis Spectator | Login pertama → role Spectator, hanya baca | B |
| FR-003 | Satu user satu role dan satu penempatan | User hanya memiliki satu role dan satu unit/section pada level yang sesuai; Staff/PIC, Manager, dan SM wajib memiliki atasan aktif sesuai rantai role dan cakupan organisasi; kombinasi yang tidak sesuai ditolak | B/D |
| FR-004 | Pemberian/perubahan role sesuai kewenangan | Super Admin menetapkan role/penempatan dan memutuskan usulan; GM hanya dapat mengusulkan perubahan untuk user dalam cakupannya; SM tidak dapat menetapkan atau mengusulkan perubahan; role target tidak berubah sebelum disetujui Super Admin | B/C |
| FR-005 | Add, edit, aktif/nonaktif user | User nonaktif tidak bisa login | B |
| FR-006 | Master struktur organisasi | 2 unit, 7 section; hirarki department → unit → section | B |

## Task
| ID | Kebutuhan | AC | Asal |
|---|---|---|---|
| FR-020 | Membuat task: judul, PIC, timeline (mulai, tenggat), prioritas, section | Task tersimpan berstatus To do; PIC dinotifikasi | B |
| FR-021 | CRUD task sesuai role dan cakupan | Aksi di luar cakupan ditolak di API | B |
| FR-022 | Mencatat support yang dibutuhkan (dari siapa, status diminta/diberikan) | Support tampil di detail task | B |
| FR-023 | Evidence wajib ditentukan saat task dibuat | Task tanpa daftar evidence boleh, tetapi gerbang BR-020 berlaku atas yang ada | B |
| FR-024 | PIC mengunggah evidence (file/link) | Evidence terkait ke persyaratan tertentu | B |
| FR-025 | PIC memperbarui progress % | Nilai 0–100; riwayat tersimpan | B |
| FR-026 | Alur status sesuai BR-001 | Transisi tidak sah ditolak | B |
| FR-027 | Gerbang evidence sebelum Review | Pengajuan Review dengan evidence kurang → ditolak; tidak berlaku untuk task milik GM/Super Admin (BR-022) | B |
| FR-028 | Blocked mewajibkan support | Blocked tanpa support → ditolak | B |
| FR-029 | Daftar task dengan filter section, status, PIC, periode | Filter dan hasil sesuai cakupan role | B |
| FR-030 | Pindah task dengan alasan wajib | Hanya ke target yang diizinkan; PIC baru dinotifikasi | B |
| FR-031 | Riwayat pemindahan | Dari, ke, waktu, alasan tersimpan | B |

## Review dan deadline
| ID | Kebutuhan | AC | Asal |
|---|---|---|---|
| FR-040 | Review oleh atasan langsung | Hanya reviewer sesuai rantai BR-070 yang bisa approve/reject; task milik GM dan Super Admin tidak memiliki reviewer (D-015, D-019; pemilik bebas menandai Done langsung atau me-review sendiri, BR-022) | B |
| FR-041 | Approve → Done; Reject → Revisi + komentar wajib | Reject tanpa komentar ditolak | B |
| FR-060 | PIC mengajukan perubahan deadline (tanggal baru, alasan) | Deadline lama tetap sampai disetujui | B |
| FR-061 | SM/GM/Super Admin menyetujui atau menolak | Manager tidak bisa menyetujui | B |
| FR-062 | Keputusan dan waktu tercatat | Tampil di riwayat dan audit log | B |
| FR-063 | Checkpoint dihitung ulang setelah disetujui | Checkpoint berikutnya memakai deadline baru | B |
| FR-064 | Role berwenang mengubah deadline langsung | Tanpa approval; tercatat di audit log | B |

## Reminder dan notifikasi
| ID | Kebutuhan | AC | Asal |
|---|---|---|---|
| FR-050 | Scheduler menghitung % waktu berjalan task aktif | Timeline ≥ 24 jam: rumus BR-030; timeline < 24 jam: elapsed checkpoint dan gate progres memakai bobot leaf WBS (BR-030a); uji dengan jam tiruan | B/C |
| FR-051 | Reminder 50% bila progress < 50% | Progress ≥ 50% → tidak ada reminder | B |
| FR-052 | Reminder 80% dan 90% bila belum Done (termasuk Blocked, Review, Revisi) | Status Done → tidak ada reminder; Blocked/Review/Revisi → tetap dikirim (D-017) | B/C |
| FR-053 | Reminder hanya ke PIC | Tidak ada reminder ke Manager/SM/GM/Super Admin | B |
| FR-054 | PIC menanggapi reminder | Tiga pilihan tanggapan tersimpan | B |
| FR-055 | Notifikasi ke Manager, SM, GM, Super Admin atas tanggapan/progress PIC | Sesuai BR-035 | B |
| FR-056 | Kanal in-app dan email | Keduanya terkirim | B |
| FR-057 | Task lewat tenggat ditandai Lewat | Tanpa reminder tambahan | B |
| FR-058 | Checkpoint idempoten | Scheduler dijalankan ulang → tidak ada pengiriman ganda | D |
| FR-080 | Halaman notifikasi (semua, belum dibaca) | Item dapat ditandai dibaca | B |

## Dashboard, report, master
| ID | Kebutuhan | AC | Asal |
|---|---|---|---|
| FR-070 | Dashboard ringkasan: total, tertinggal, blocked, menunggu review, pengajuan deadline | Angka sesuai cakupan role | B |
| FR-071 | Daftar task yang melewati checkpoint | Terurut dan terfilter | B |
| FR-072 | Progress per orang dan per section | Sesuai cakupan role | B |
| FR-090 | Laporan progres per section/unit, ketepatan waktu, task terlambat | Periode berdasarkan tenggat efektif; tepat waktu = Done pada/sebelum tenggat ÷ semua task jatuh tempo × 100%; task belum Done setelah tenggat dan Done terlambat masuk daftar terlambat; penyebut nol ditampilkan N/A | B |
| FR-091 | Export Excel dan PDF | File terunduh dan isi sesuai filter | B |
| FR-092 | Audit log perubahan data dan role | Tidak bisa diubah/dihapus dari UI | B |
| FR-100 | Master kategori dan template task rutin serta pembuatan task otomatis berkala | Role berwenang dapat mengelola master sesuai cakupan; jadwal aktif membuat task dari template secara idempoten, sesuai aturan BR dan tanpa melewati akses server-side | B/C (CR-0003) |
| FR-110 | Tampilan Kanban: enam kolom sesuai status, kartu berisi judul, PIC, tenggat, progress; filter section, PIC, prioritas, periode | Kartu di kolom sesuai status; semua role yang berhak mengubah task dapat memindahkan kartu dalam cakupannya, Spectator hanya melihat (BR-080); transisi tetap tunduk BR-001/002/020/021/022 dan transisi tidak sah ditolak; Staff/PIC yang mengubah tenggat hanya membuat pengajuan (BR-081) | C |
| FR-111 | Tampilan Timeline: bar mulai–tenggat per task, dikelompokkan per orang/section, penanda tenggat dan Lewat, beban kerja per orang pada periode | Bar sesuai start_date–due_date; cakupan sesuai role; filter periode; PIC tidak dapat mengubah start_date langsung dan perubahan due_date tetap melalui pengajuan; Manager+ dapat mengubah start_date dalam cakupan, tenggat langsung mengikuti BR-041 (BR-081, D-036) | C |

## Non-fungsional
| ID | Kebutuhan | Asal |
|---|---|---|
| NFR-001 | RBAC ditegakkan di server untuk semua endpoint | B/D |
| NFR-002 | Filter data berdasarkan posisi user di pohon organisasi | B |
| NFR-003 | Semua perubahan role dan keputusan approval masuk audit log | B |
| NFR-004 | Zona waktu dan hitungan checkpoint konsisten (lihat OQ-03) | D |
| NFR-005 | File evidence disimpan terpisah dari database dengan kontrol akses | D |
