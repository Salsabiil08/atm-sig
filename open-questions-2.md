# Pertanyaan Terbuka

Agent wajib menambahkan pertanyaan di sini ketika menemukan ambiguitas; **jangan mengisi kekosongan dengan asumsi**. Pemilik proyek menetapkan keputusan, lalu keputusan final dicatat dalam `decisions/decision-log.md` dan disinkronkan dengan FR/BR/NFR/ADR serta test terkait.

**Pembaruan:** 19 Oktober 2026
**Dasar:** Persetujuan pemilik proyek atas rekomendasi OQ dan penegasan terakhir: **Resend dipilih**; notifikasi task dimulai dari **push/notifikasi aplikasi**, **email reminder hanya jika tidak ada respons selama 3 hari**; **semua evidence disimpan terus**, perpindahan Storage dilakukan manual jika kapasitas diperlukan; penggunaan **Vercel + Supabase disetujui pemilik data**.  
**Catatan sinkronisasi:** `decisions/decision-log.md` asli belum dilampirkan. Keputusan yang disetujui tersedia di `decision-log-additions.md`. **Jangan menciptakan ID keputusan D- baru** tanpa memeriksa log asli terlebih dahulu.

## Masih terbuka: persetujuan mockup

| ID | Hal yang belum final | Ketentuan yang telah diputuskan | Langkah berikutnya | Dampak | Status |
|---|---|---|---|---|---|
| OQ-14 | Mockup Kanban dan timeline/Gantt **belum tersedia**; belum ada persetujuan desain final. | Timeline berupa **Gantt sederhana**; job load MVP menampilkan task aktif, mendekati deadline (>= 80% waktu), dan overdue per PIC. Kolom dan kewenangan Kanban mengacu **D-020**. | Codex membuat mockup/wireframe dari requirement dan D-020, kemudian pemilik proyek meninjau dan menyetujuinya sebelum implementasi UI final. | FR-111, T-506, CR-0001 | **Pending mockup** |

**OQ-14 merupakan satu-satunya OQ yang menunggu persetujuan pemilik proyek.** Kesiapan teknis lainnya merupakan pekerjaan implementasi, bukan pertanyaan bisnis baru.

## Keputusan baru yang sudah final (18–19 Oktober 2026)

| ID | Keputusan pemilik proyek | Konsekuensi implementasi | Dampak | Status |
|---|---|---|---|---|
| OQ-07 | **Resend** melalui HTTPS API dipilih; **tidak menggunakan SMTP perusahaan**. Notifikasi awal task, reminder checkpoint, assignment, dan approval dikirim melalui **notifikasi aplikasi/push**, **bukan email**. **Email reminder hanya dikirim setelah 3 hari tanpa respons** atas reminder aplikasi. | Buat antrean notifikasi aplikasi, status respons, pengecekan eskalasi setelah 72 jam kalender, dan pengiriman satu email yang idempoten untuk reminder yang belum direspons. Detail aturan di bawah. Perlu akun Resend, pengirim/domain terverifikasi dan API key pada server sebelum email production dinyalakan. | FR-050, FR-056, BR-030, BR-030a, FR-065 | **Approved; setup provider masih pekerjaan teknis** |
| OQ-10 | **Seluruh evidence disimpan terus**, tanpa batas retensi otomatis, pembagian arsip aktif/inaktif wajib, atau pemusnahan terjadwal. Jika Storage Supabase penuh/mendekati batas, pemilik data dapat menginstruksikan **pemindahan manual** ke file storage lain. | Simpan evidence private dengan kontrol akses dan metadata/tautan task yang persisten. Tidak membangun scheduler retensi, auto-archive, atau auto-delete. Pemindahan manual harus memvalidasi file, menjaga metadata/tautan, dan dicatat audit log. Batas awal unggahan tetap 20 MB/file serta PDF/XLSX/DOCX/JPG/JPEG/PNG sampai ada keputusan pengganti. | FR-024, NFR-005 | **Approved; aturan retensi sebelumnya digantikan** |
| OQ-18 | **Next.js di Vercel; PostgreSQL/Auth/Storage/Cron di Supabase** tetap final. Pemilik data **menyetujui penggunaan cloud tersebut**; tidak ada persetujuan compliance perusahaan tambahan yang dijadikan prasyarat proyek. | Tidak membuka evaluasi ulang penyedia cloud. Tetap implementasikan keamanan teknis, kontrol akses, backup/recovery, batas kuota/biaya, serta konfigurasi paket/region yang sesuai sebelum production. | ADR-0001, D-021, FR-050 | **Approved; pemeriksaan teknis masih perlu dilakukan** |

## Keputusan lainnya yang sudah disetujui

| ID | Pertanyaan | Jawaban yang disetujui | Dampak | Referensi keputusan |
|---|---|---|---|---|
| OQ-03 | Checkpoint timeline, perhitungan WBS, dan kalender | Reminder pada **80% dan 90% waktu terpakai** antara start efektif dan deadline; pekerjaan selesai dihitung dari **bobot item WBS selesai**. Durasi **< 24 jam kalender** dikategorikan singkat; timeline **>= 24 jam** juga dihitung menggunakan waktu/hari kalender. Zona waktu **Asia/Jakarta**. Status Blocked dan Review tetap belum Done (D-017). **Kanal reminder awal adalah aplikasi/push; email hanya bila 72 jam tak direspons.** | FR-050, BR-030, BR-030a | Persetujuan 2026-10-18; D-ID menunggu sinkronisasi |
| OQ-05 | Template rutin atau task otomatis | Master template **dan** generate task otomatis harian/mingguan/bulanan, jadwal bisa diaktifkan/nonaktifkan; satu task per template-periode (idempotent). | FR-100, scope | Persetujuan 2026-10-18; D-ID menunggu sinkronisasi |
| OQ-08 | Login lokal atau SSO | MVP menggunakan **Supabase Auth email/password**. SSO tidak dibangun kecuali menjadi kebutuhan baru yang disetujui. **Email autentikasi** untuk verifikasi/reset password, bila diperlukan, adalah email transaksional terpisah dari kebijakan reminder task 3 hari. | FR-001, NFR-001 | Persetujuan 2026-10-18; D-ID menunggu sinkronisasi |
| OQ-09 | Checkpoint setelah perubahan deadline | Perubahan deadline berlaku **setelah disetujui**. Riwayat checkpoint yang sudah terkirim **tetap** dan tidak dikirim ulang; checkpoint yang belum terkirim dijadwalkan ulang menurut deadline yang disetujui. Status respons/escalation harus mengacu notifikasi dan penerima spesifik. | BR-038 | Persetujuan 2026-10-18; D-ID menunggu sinkronisasi |
| OQ-11 | Penetapan unit/section dan supervisor | Penempatan awal akun undangan mengikuti unit inviter. Super Admin menetapkan role/penempatan; GM hanya mengusulkan perubahan; SM tidak menetapkan langsung. | FR-004, BR-035 | Persetujuan 2026-10-19 (D-023, D-024) |
| OQ-12 | Rumus ketepatan waktu | **Task Done tepat waktu ÷ seluruh task jatuh tempo dalam periode × 100%**. Task belum Done yang telah jatuh tempo masuk penyebut; task dibatalkan dikecualikan. Gunakan deadline yang disetujui dan efektif saat penyelesaian; catat riwayat revisinya. | FR-090 | Persetujuan 2026-10-18; D-030 |
| OQ-15 | Notifikasi Super Admin pada perubahan deadline | Super Admin dapat melihat seluruh pengajuan pada layar Approval. **Push/notifikasi aplikasi** hanya dikirim kepada pihak yang menjadi approver relevan atau target eskalasi; **tidak ada email awal**, dan email hanya dapat mengikuti aturan reminder tak direspons selama 3 hari. | FR-065, BR-035 | Persetujuan 2026-10-18; D-ID menunggu sinkronisasi |
| OQ-16 | TOP karyawan dan job load | Skor KPI operasional: **ketepatan waktu 50%, kualitas first-pass review 30%, tingkat penyelesaian 20%**. Indikator tak berlaku (mis. tiada reviewer menurut D-015) dikecualikan dan bobot lainnya dinormalisasi. Job load = jumlah task aktif serta indikator mendekati deadline/overdue, bukan bobot WBS. | FR-073, FR-074 | Persetujuan 2026-10-18; D-ID menunggu sinkronisasi |
| OQ-17 | Bobot, hierarki, dan kewenangan WBS | Item WBS level terendah berbobot **sama rata secara default**, boleh disesuaikan hingga total **100%**. Maksimal **2 level WBS di bawah task**; bobot parent dan child tidak dihitung ganda. PIC mengusulkan perubahan; Supervisor menyetujui perubahan baseline. | FR-032, BR-011 | Persetujuan 2026-10-18; D-ID menunggu sinkronisasi |

## Aturan implementasi yang tidak boleh diinterpretasikan ulang

1. **Progres waktu** = `(waktu sekarang - start efektif) / (deadline efektif - start efektif) × 100%` (dibatasi untuk tampilan 0–100%). Checkpoint 80% dan 90% mengikuti **waktu**, bukan WBS. Berlaku selama task belum Done; Blocked/Review tetap eligible (D-017). Jangan menggandakan checkpoint yang sama. `deadline > start` wajib divalidasi.
2. **Progres pekerjaan** = `Σ bobot item WBS level terendah yang selesai / Σ bobot seluruh item WBS level terendah × 100%`. Parent WBS hanya grouping; bobot leaf berjumlah 100%.
3. **Perubahan deadline:** histori checkpoint terkirim tetap ada; checkpoint yang belum terkirim disesuaikan. Audit deadline lama/baru, alasan, aktor, waktu, dan persetujuan. Eskalasi email untuk reminder lama hanya dilakukan jika reminder tersebut masih relevan, task masih perlu tindak lanjut, dan belum direspons.
4. **Task rutin:** satu template + periode menghasilkan maksimal satu task; aktivitas mengubah template tidak memutasi task historis secara diam-diam.
5. **Ketepatan waktu:** denominasi semua task yang deadline-nya jatuh pada periode (termasuk overdue belum Done; kecuali cancelled); pembilang hanya Done tepat waktu. Jika penyebut nol, hasil `N/A`.
6. **TOP karyawan:** ketepatan waktu 50%, first-pass review 30%, penyelesaian 20%. Skala indikator 0–100; tanpa reviewer, bobot tersisa dinormalisasi. Skor ini untuk dashboard operasional, bukan otomatis penilaian SDM formal.
7. **Evidence:** Storage Supabase private dengan otorisasi role/unit/section; format PDF/XLSX/DOCX/JPG/JPEG/PNG dan maksimum 20 MB/file pada MVP. Simpan **tanpa tanggal kedaluwarsa otomatis**. Tidak membuat status arsip wajib, kalkulasi retensi, auto-delete, atau pemindahan otomatis. Jika ada migrasi manual ke storage lain, pertahankan referensi evidence task, metadata, audit trail, dan verifikasi integritas file terlebih dahulu. Backup objek Storage harus direncanakan terpisah dari database.
8. **Notifikasi:** aturan definitif berada pada bagian berikutnya. Semua email task awal dilarang; **email reminder Resend baru layak dikirim setelah 72 jam kalender tanpa respons**. Email verifikasi, undangan atau reset password dari alur Supabase Auth merupakan pengecualian yang terpisah.
9. **UI:** Kanban/Gantt tidak difinalisasi sebelum mockup disetujui berdasarkan D-020. Logic backend dan mockup boleh dikerjakan.
10. **Infrastruktur:** pilihan cloud dan kewenangan pemilik data sudah final; tidak perlu meminta persetujuan compliance ulang. Keamanan, recovery, dan kapasitas adalah pemeriksaan implementasi wajib.

## Mekanisme notifikasi dan eskalasi email — OQ-07 (final)

### Alur kanal

1. Saat ada assignment, approval, reminder checkpoint 80%/90%, atau reminder pekerjaan lain, buat **notifikasi pada aplikasi** terlebih dahulu (notification center/badge dan real-time ketika app dibuka). Upayakan **Web Push** ketika browser/perangkat mendukung dan pengguna memberi izin; in-app notification tetap tersedia jika izin push ditolak/perangkat tidak mendukung. **Jangan mengirim email untuk notifikasi awal tersebut.**
2. Reminder aplikasi mencatat `notification_id`, `task_id`, `recipient_user_id`, `reminder_type`, `sent_at`, dan status respons. Checkpoint terkait tidak dibuat berulang hanya karena scheduler dieksekusi ulang.
3. Untuk keperluan implementasi, **respons terhadap reminder** berarti penerima **menekan aksi Acknowledge/Tanggapi**, memberikan komentar/tanggapan yang relevan, atau membuat pembaruan progres/status pada task setelah reminder muncul. **Sekadar membuka/membaca notifikasi tidak dihitung sebagai respons.** Catat `responded_at` dan jenis respons. Respons tidak otomatis berarti task selesai.
4. **Tiga hari = 72 jam kalender**, dihitung sejak **reminder aplikasi pertama yang belum direspons** untuk task dan penerima tersebut. Reminder berikutnya dalam siklus belum direspons yang sama **tidak mereset** penghitungan 72 jam. Scheduler memeriksa syarat dan mengirim **satu email eskalasi** via Resend per siklus belum direspons, bukan satu email untuk setiap checkpoint.
5. Tepat sebelum mengirim email, periksa kembali: sudah >= 72 jam sejak reminder pertama, **belum ada respons**, task **belum Done/Cancelled**, reminder masih relevan, penerima masih bertanggung jawab, dan eskalasi untuk siklus itu belum pernah terkirim. Bila tidak terpenuhi, jangan kirim email. Untuk task berstatus Review, tujuan follow-up ialah reviewer yang bertanggung jawab, bukan otomatis PIC awal.
6. Email berisi nama task, jenis reminder, PIC/penanggung jawab yang dituju, deadline saat ini, ringkasan keterlambatan respons, dan tautan aman menuju task setelah login. Tidak mengirim evidence sebagai lampiran. Catat hasil pengiriman dan retry yang idempoten.
7. **Email Supabase Auth** (verifikasi identitas/reset password/undangan akun bila digunakan) berjalan sesuai kebutuhan autentikasi dan **bukan** notifikasi reminder task; tidak perlu menunggu 3 hari. Gunakan Resend HTTPS API/Send Email Hook bila dikonfigurasi untuk alur itu.

### Acceptance tests minimal

| Skenario | Hasil yang diwajibkan |
|---|---|
| Reminder 80% pertama muncul | Ada notifikasi in-app/push; **tidak ada email**. |
| Reminder tetap belum direspons setelah 48 jam | **Tidak ada email**. |
| Reminder belum direspons setelah 72 jam dan task masih berjalan | **Satu email** via Resend kepada penanggung jawab terkait. |
| Reminder 90% menyusul sebelum 72 jam dan belum ada respons | Hitung tetap dari reminder pertama; **tidak mengirim dua email**. |
| Penerima acknowledge, komentar, atau memperbarui task sebelum 72 jam | Email dibatalkan; membuka notifikasi tanpa tanggapan tidak membatalkan. |
| Task Done/Cancelled sebelum jadwal email | Email tidak dikirim. |
| Scheduler retry atau job dijalankan dua kali | Tidak terjadi email ganda untuk siklus reminder sama. |
| Email autentikasi Supabase Auth | Bisa dikirim saat diperlukan tanpa aturan tunda 72 jam. |

### Konfigurasi email

- Provider: **Resend HTTPS API (FINAL)**. SMTP perusahaan **tidak digunakan**.
- Siapkan akun, domain/subdomain pengirim dan verifikasi DNS, sender address, serta API key yang disimpan di environment server (tidak di client). Ini **langkah konfigurasi teknis**, bukan keputusan vendor yang masih terbuka.
- Kirim email reminder melalui backend/Edge Function yang terautorisasi; scheduler tunggal (Supabase Cron) menangani pengecekan eskalasi serta generator task rutin, dengan job idempoten dan audit.
- Untuk notifikasi browser push, perhatikan persetujuan browser dan dukungan perangkat; jangan menganggap notifikasi in-app saja sama dengan push ketika aplikasi ditutup.

## Penyimpanan evidence — OQ-10 (final)

- Semua evidence **disimpan tanpa batas retensi otomatis** di Storage aktif yang tersedia. Ketentuan lama tentang pembagian umur arsip dan pemusnahan periodik **digantikan** oleh keputusan ini.
- Sistem **tidak** membangun migrasi otomatis hanya karena kapasitas mendekati limit. Pantau kuota, kemudian pemilik data memutuskan **pemindahan manual** ke storage lain bila diperlukan.
- Migrasi manual harus memeriksa keterbacaan/hash file, akses private, metadata, dan hubungan evidence dengan task, serta mencatat pelaku/waktu/lokasi baru; tautan evidence yang dipakai aplikasi tidak boleh rusak.
- Backup dan uji restore file tetap merupakan aspek keselamatan data. Backup database saja tidak menjamin pemulihan file Supabase Storage.

## Kesiapan production — OQ-18 (tanpa persetujuan compliance tambahan)

1. **Pilihan stack dan data:** Next.js/Vercel + PostgreSQL/Auth/Storage/Cron/Supabase adalah final. Pemilik data menyatakan penggunaan cloud **tidak bermasalah** dan tidak meminta review kebijakan organisasi tambahan.
2. **Keamanan minimum:** Supabase Auth, RLS pada tabel yang diekspos, private Storage dan policy berbasis role/unit/section, akses admin/MFA, API key dan secret hanya di server, serta audit aktivitas penting.
3. **Kapasitas dan recovery:** monitor Storage/kuota/biaya, siapkan backup terpisah untuk objek Storage dan database, jalur pemulihan, serta prosedur pemindahan file **manual** bila diperlukan. Tidak ada kewajiban membuat mekanisme retensi otomatis.
4. **Konfigurasi deployment:** tentukan region (Singapura `ap-southeast-1` kandidat), lokasi Function yang relevan, dan paket Vercel/Supabase yang sesuai batas vendor dan beban penggunaan; tidak mengubah platform yang dipilih.
5. **Scheduler tunggal:** gunakan Supabase Cron untuk pengingat aplikasi, pemeriksaan eskalasi email 72 jam, dan pembuatan task rutin, dengan lock/idempotensi dan audit; jangan membuat Vercel Cron kedua untuk pekerjaan yang sama.

**Referensi teknis (verifikasi kembali sebelum implementasi):**
- https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
- https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/cron
- https://vercel.com/docs/limits/fair-use-guidelines

## Terjawab sebelumnya — jangan diubah

| ID | Pertanyaan | Jawaban | Keputusan |
|---|---|---|---|
| OQ-02 | Siapa reviewer untuk task GM dan Super Admin? | Tidak ada | D-015 |
| OQ-04 | Apakah Blocked dan Review dihitung "belum Done" untuk reminder 80% dan 90%? | Ya | D-017 |
| OQ-06 | Apakah Kanban/timeline masuk scope? | Boleh (masuk scope) | D-018, CR-0001 |
| OQ-13 | Task GM/Super Admin tanpa reviewer: Review dilewati? Evidence wajib? | Bebas: boleh langsung Done atau review sendiri | D-019 |
| OQ-01 | Stack teknologi apa yang dipakai? | Next.js, Vercel, PostgreSQL di Supabase | D-021, ADR-0001 |

## Checklist sinkronisasi proyek

- [ ] Gabungkan keputusan yang disetujui ke **`decisions/decision-log.md` asli** dengan nomor D yang tersedia; jangan menebak ID.
- [ ] Sinkronkan FR-050, FR-056, BR-030, BR-030a, BR-038, FR-065, FR-024, NFR-005, FR-090, FR-073, FR-074, FR-032, BR-011, ADR-0001 dan acceptance tests.
- [x] Pilih **Resend** dan tetapkan **notifikasi awal aplikasi/push; email reminder jika tidak ada respons 72 jam kalender** (OQ-07).
- [ ] Konfigurasi Resend (akun, domain pengirim terverifikasi, DNS, API key); uji pengiriman email eskalasi dan pengecualian Auth.
- [x] Tetapkan **evidence disimpan terus tanpa retensi/pemindahan otomatis**; migrasi manual jika kapasitas perlu (OQ-10).
- [x] Tetapkan **Vercel + Supabase**, dengan penggunaan cloud disetujui pemilik data (OQ-18).
- [ ] Periksa keamanan, backup objek Storage, kuota dan paket production secara teknis; **tidak memerlukan keputusan compliance tambahan**.
- [ ] Buat mockup Kanban/Gantt mengikuti D-020 lalu minta persetujuan desain dari pemilik proyek (OQ-14).
