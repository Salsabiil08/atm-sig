# 11 — Checklist UAT M6

Gunakan akun uji yang mewakili setiap role dan penempatan. Jangan gunakan data pribadi atau task produksi. Catat build/commit, tanggal, pelaksana, hasil, dan bukti untuk setiap skenario. `Lulus` hanya jika hasil aktual sesuai harapan; `Gagal` harus menyertakan langkah reproduksi.

## Informasi pelaksanaan

| Build/commit | Tanggal | Pelaksana | Lingkungan |
|---|---|---|---|
| Belum diisi | Belum diisi | Pemilik proses / wakil role | Belum diisi |

## Skenario per role

| Role / konteks | Skenario | Hasil yang diharapkan | Status / bukti |
|---|---|---|---|
| Spectator pada section | Buka daftar task, detail, timeline, dan notifikasi; coba kontrol perubahan | Hanya data pada cakupan penempatan dan turunannya yang terlihat; tidak ada kontrol tulis | Belum diuji |
| Staff/PIC | Perbarui progress, status yang diizinkan, evidence, support, dan tanggapan reminder pada task milik sendiri | Perubahan sah tersimpan; task lain tidak dapat diubah; Review/Done tanpa evidence wajib ditolak | Belum diuji |
| Staff/PIC | Ajukan perubahan tenggat dan coba mengubah `start_date` melalui UI/API | Form mengajukan `due_date` dengan alasan; tenggat belum berubah sebelum approval; edit langsung `start_date` ditolak | Belum diuji |
| Manager pada section | Pantau task, pindahkan status standar, edit tanggal mulai, edit tenggat, dan tinjau task PIC | Data dan perubahan hanya pada section sendiri; transisi tetap mengikuti gerbang task; tanggal mulai < tenggat dan tercatat di audit | Belum diuji |
| SM Accounting | Pantau task dan filter section/PIC; proses approval tenggat pada unit sendiri | Hanya task dalam unit Accounting; aksi yang tidak diizinkan lintas unit ditolak | Belum diuji |
| SM Reporting | Pantau task dan filter section/PIC; proses approval tenggat pada unit sendiri | Hanya task dalam unit Reporting; aksi yang tidak diizinkan lintas unit ditolak | Belum diuji |
| GM | Lihat dashboard, laporan, Kanban, Gantt, audit log; tinjau task tanpa reviewer miliknya | Cakupan lintas unit sesuai role; Revisi meminta komentar; kontrol self-review mengikuti aturan | Belum diuji |
| Super Admin | Kelola user/role dan tinjau dashboard, laporan, audit, Kanban, serta Gantt | Aksi sesuai kewenangan tercatat; API tidak membuka mutasi tanpa pemeriksaan dan audit | Belum diuji |

## S-1..S-6 — bukti penerimaan

| Ukuran | Bukti otomatis yang tersedia | Verifikasi UAT | Status |
|---|---|---|---|
| S-1 — Review/Done memerlukan semua evidence wajib | Tes database status/evidence dan tes UI Review | Coba kirim task tanpa evidence wajib; pastikan ditolak | Belum diuji |
| S-2 — PIC, timeline, support, evidence pada detail | Tes komponen detail task | Pastikan seluruh informasi task aktif ada pada layar detail | Belum diuji |
| S-3 — Reminder 50/80/90 tepat satu kali dan hanya ke PIC | Tes scheduler, idempotensi, penerima, dan waktu batas | Tinjau hasil simulasi scheduler pada lingkungan uji | Belum diuji |
| S-4 — Atasan mendapat notifikasi tanggapan/progress | Tes action dan notifikasi | Pastikan inbox role atasan menerima notifikasi yang relevan | Belum diuji |
| S-5 — Tidak ada aksi di luar hak role | Tes RLS/API langsung dan tes server action | Coba kontrol yang dilarang pada akun uji; pastikan UI dan API menolak | Belum diuji |
| S-6 — Perubahan tenggat PIC menunggu approval | Tes action, RLS, trigger, dan approval | Pastikan tenggat lama tetap berlaku sampai pengajuan disetujui | Belum diuji |

## Temuan dan sign-off

| ID | Skenario | Langkah reproduksi | Hasil aktual | Tindak lanjut | Status |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Pemilik proses: ____________________  Tanggal: ____________________  Keputusan: **Menunggu UAT**
