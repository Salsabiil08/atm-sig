# Pertanyaan Terbuka

Agent wajib menambah baris di sini (bukan menebak) saat menemukan ambiguitas. Pemilik proyek menjawab dan memindahkan jawaban ke `decisions/decision-log.md`.

## Terbuka
| ID | Pertanyaan | Dampak | Status |
|---|---|---|---|
| OQ-18 | Apakah D-01 dalam laporan audit (PIC boleh membuat task hanya untuk dirinya dengan reviewer atasan langsung) telah disahkan pemilik proyek? | FR-020/021, BR-070; mengubah role yang boleh membuat task dan aturan owner/reviewer | Menunggu konfirmasi pemilik; belum tercatat di decision log |
| OQ-19 | Apakah D-02 dalam laporan audit (deadline berlaku sampai akhir hari WIB) telah disahkan pemilik proyek, termasuk dampak terhadap timestamp task yang sudah tersimpan? | BR-036; mengubah overdue, reminder, serta tanggal yang disimpan dan ditampilkan | Menunggu konfirmasi pemilik; belum tercatat di decision log |
| OQ-01 | Stack teknologi apa yang dipakai? | Semua milestone (ADR-0001) | Terbuka |
| OQ-05 | Template task rutin: apakah juga membuat task otomatis berkala? | FR-100, CR-0003 | Terjawab: termasuk pembuatan otomatis berkala; CR-0003 disetujui |
| OQ-10 | Batas ukuran/jenis file evidence dan masa simpan | FR-024, NFR-005 | Sebagian terjawab: implementasi membatasi 20 MB dan PDF/JPG/PNG/CSV; masa simpan belum diputuskan |
| OQ-14 | Mockup Kanban dan Gantt perlu disetujui sebelum dibangun. Bentuk timeline dan beban kerja ditetapkan sebagai Gantt dan jumlah task aktif per PIC. | FR-110, FR-111, T-506 | Terjawab: Gantt, beban kerja jumlah task aktif per PIC (D-031); mockup T-506 disetujui 2026-10-20 |
| OQ-15 | Istilah "Manager Verification 1" pada PR-2 tidak ditemukan pada seed struktur organisasi; konfirmasi section mana yang akan menjadi penempatan Manager tersebut. Kebijakan tetap membatasi semua Manager ke section penempatannya. | PR-2, NFR-002 | Implementasi aman dengan cakupan section; menunggu pemetaan nama |
| OQ-16 | Aturan operasional pembuatan task otomatis dari template: frekuensi, waktu/zona waktu, jadwal terlewat, dampak edit template, dan nilai PIC/reviewer/timeline yang diwarisi. | FR-100, CR-0003 | Terjawab: mingguan/bulanan, 08.00 WIB, jadwal terlewat dilewati, task hasil tidak berubah saat template diedit, PIC/reviewer/offset tanggal dari template (D-034); tanggal 29–31 yang tidak ada memakai hari terakhir bulan (D-035) |

| OQ-17 | Apakah PIC dapat mengubah tanggal mulai task atau hanya tenggat melalui pengajuan? | FR-111, BR-081 | Terjawab: PIC tidak dapat mengubah `start_date` langsung; form pengajuan hanya untuk `due_date`, Manager+ dapat mengubah tanggal mulai dalam cakupan (D-036) |

## Terjawab
| ID | Pertanyaan | Jawaban | Keputusan |
| OQ-17 | Apakah PIC dapat mengubah tanggal mulai task atau hanya tenggat melalui pengajuan? | PIC tidak dapat mengubah `start_date` secara langsung. Pengajuan tetap mengubah tenggat (`due_date`) saja; Manager+ boleh mengubah tanggal mulai langsung dalam cakupan. | D-036 |
|---|---|---|---|
| OQ-02 | Siapa reviewer untuk task GM dan Super Admin? | Tidak ada | D-015 |
| OQ-04 | Apakah Blocked dan Review dihitung "belum Done" untuk reminder 80% dan 90%? | Ya | D-017 |
| OQ-06 | Apakah Kanban/timeline masuk scope? | Boleh (masuk scope) | D-018, CR-0001 |
| OQ-13 | Task GM/Super Admin tanpa reviewer: Review dilewati? Evidence wajib? | Bebas: boleh langsung Done atau review sendiri | D-019 |
| OQ-08 | Metode login: akun lokal (username/password) atau SSO perusahaan? | Supabase Auth email/password | D-021 |
| OQ-11 | Siapa yang menetapkan penempatan unit/section dan supervisor saat role diberikan? | Penempatan awal akun undangan mengikuti unit inviter. Super Admin menetapkan role/penempatan; GM hanya mengusulkan perubahan; SM tidak menetapkan langsung. | D-023, D-024 |
| OQ-03 | Dasar pengukuran checkpoint untuk task berdurasi kurang dari 24 jam | WBS leaf berbobot selesai/total bobot leaf; reminder pada elapsed 50/80/90 jika pekerjaan selesai masih di bawah checkpoint; timestamp absolut, Asia/Jakarta hanya untuk tampilan. | D-028 |
| OQ-12 | Definisi laporan "ketepatan waktu" (rumus) | Task Done tepat waktu ÷ seluruh task dengan tenggat jatuh dalam periode × 100%; task belum Done setelah tenggat tetap menjadi penyebut; task dibatalkan dikecualikan; tenggat yang berlaku saat selesai dipakai; penyebut nol = N/A. | D-030 |
| OQ-07 | Penyedia email dan waktu pengiriman | Resend HTTPS API; email hanya setelah 72 jam kalender tanpa respons, bukan saat reminder in-app dibuat. | ADR-0001 |
| OQ-09 | Perilaku checkpoint setelah tenggat berubah | Deadline baru membuat versi checkpoint; histori lama dipertahankan dan reminder tiap checkpoint diizinkan sekali pada versi baru. | D-028 |
