# 06 — Arsitektur

Sumber: Blueprint R.01 bagian 4.1. Teknologi dan infrastruktur final ditentukan tim pengembang lewat ADR-0001; dokumen ini hanya mengikat **komponen logis**.

## Komponen
- **Frontend Web** — layar pada `docs/07-ui-screens.md`.
- **Backend API + RBAC** — satu-satunya titik penegakan hak akses (NFR-001, PR-1).
- **Database Task** — model pada `docs/05-data-model.md`.
- **File Storage Evidence** — penyimpanan file evidence dengan kontrol akses (NFR-005).
- **Scheduler Reminder** — job berkala untuk checkpoint (BR-030..BR-038).
- **Layanan Notifikasi** — in-app dan email.
- **Master kategori dan template task rutin (FR-100, CR-0003)** — dikelola SM sesuai unitnya dan GM/Super Admin lintas unit. Scheduler membuat task baru dari snapshot template dengan pencatatan idempoten.

Pemindahan kartu Kanban memakai state machine BR-001 yang sama melalui server action dan trigger database. PIC dan pengelola dalam cakupan dapat melakukan transisi biasa; keputusan dari status Review tetap memakai aksi reviewer yang mencatat komentar dan audit (FR-110, BR-080/021).

Pembuatan task menghasilkan notifikasi in-app kepada PIC melalui trigger database `AFTER INSERT`. Dengan demikian, task dan notifikasinya tersimpan dalam transaksi yang sama, termasuk saat task dibuat melalui API database; pemindahan task tetap mengirim notifikasi terpisah melalui alur reassignment.

Supabase Cron memanggil endpoint server-only `POST /api/cron/reminders` setiap lima menit. Endpoint memvalidasi `CRON_SECRET`, lalu menjalankan RPC `process_task_reminder_checkpoints`; satu transaksi membuat reminder dan notifikasi in-app untuk PIC, dengan idempotensi `(task, checkpoint, versi deadline)`. URL aplikasi dan secret disimpan di Supabase Vault untuk pemanggilan `pg_net`; tidak ada Vercel Cron paralel.

Perubahan tanggapan reminder dan progres PIC memicu notifikasi in-app bagi reviewer langsung, SM pada unit terkait, GM, dan Super Admin aktif; pengajuan tenggat mengabari SM/GM/Super Admin, sedangkan hasil approval kembali ke PIC pengaju. Trigger database menjaga notifikasi tetap sinkron dengan transaksi sumber.

Inbox notifikasi dimuat melalui query server-side yang selalu membatasi hasil pada `user_id` sesi; RLS tetap menjadi lapisan otorisasi database. Filter belum dibaca dan pagination diterapkan di query, sedangkan penanda baca hanya mengubah baris milik penerima. Notifikasi reminder ditautkan langsung ke sumber reminder agar inbox dapat menampilkan status respons tanpa pencocokan berdasarkan waktu.

Email reminder dikelola melalui lease database 15 menit dan hanya eligible setelah 72 jam tanpa respons, selama task belum Done atau lewat tenggat. Endpoint mengirim email teks melalui Resend dengan idempotency key stabil per reminder; bila pengiriman atau pencatatan gagal, lease kedaluwarsa dan cron dapat mencoba kembali. Secret Resend tetap di environment server.

Penanda `Lewat` dihitung dari timestamp absolut saat membaca dashboard, daftar, dan detail; task `Done` tidak ditandai lewat. Scheduler checkpoint dan antrean email sama-sama mengecualikan task pada atau setelah tenggat.

Supabase Cron yang sudah berjalan setiap lima menit memanggil `process_task_template_runs` melalui endpoint server-only `POST /api/cron/reminders`; RPC memproses run pukul 08.00 Asia/Jakarta hanya jika cron mengambilnya dalam lima menit pertama. Jika slot hari ini terlewat, eksekusi dicatat sebagai skipped dan dijadwalkan pada periode berikutnya; jadwal dari tanggal sebelumnya juga dilewati tanpa susulan. Jadwal bulanan 29–31 dijalankan pada hari terakhir bulan yang lebih pendek. Task hasil adalah salinan independen sehingga perubahan template hanya memengaruhi eksekusi berikutnya. Kategori hanya dapat dibaca SM/GM/Super Admin dalam cakupan pengelolaannya dan cakupan section kategori tidak dapat dipindah.

Timeline Gantt membaca task dari query yang menerapkan scope role di server. PIC tidak dapat mengubah `start_date` melalui direct API; pengajuan deadline hanya mengubah `due_date`. Manager ke atas dapat mengubah start date dalam scope dan sebelum tenggat (FR-111, BR-081, D-036).

## Prinsip
1. Logika aturan bisnis (status, checkpoint, approval) ada di backend, bukan di UI.
2. Scheduler idempoten dan dapat diuji dengan jam tiruan.
3. Tidak ada komponen di luar daftar di atas tanpa ADR dan Change Request bila menambah scope.
4. Kunci rahasia dan konfigurasi tidak dikomit ke repo.
