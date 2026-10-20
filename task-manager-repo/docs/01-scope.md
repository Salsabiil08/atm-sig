# 01 — Scope

Sumber: Blueprint R.01 bagian 3 (Ruang Lingkup) dan decision log.

## In Scope
| Area | Isi | Rujukan |
|---|---|---|
| User Management | Role per user, user baru = Spectator, add/edit/aktif/nonaktif | Blueprint 3.2.1 |
| Master Data | Struktur organisasi, users dan role, kategori dan template task rutin termasuk pembuatan task berkala otomatis sesuai CR-0003 | 3.2.3, CR-0003 |
| Task Management | CRUD sesuai role, pindah task (alasan wajib), timeline, prioritas, support, evidence wajib, progress % | 3.2.4 |
| Evidence | Ditentukan saat task dibuat, diunggah PIC, gerbang sebelum Review | 3.2.5 |
| Review dan Approval | Review atasan langsung, approval perubahan deadline | 3.2.6 |
| Reminder dan Notifikasi | Scheduler persentase 50/80/90%, tanggapan PIC, notifikasi ke atasan, in-app dan email | 3.1, 3.2.7 |
| Dashboard | Ringkasan status, task melewati checkpoint, progress per orang/section, pengajuan deadline | 3.2.2 |
| Monitoring | Daftar task dengan filter section, status, PIC, periode | 3.2.7 |
| Tampilan Kanban dan Timeline | Kanban per status; timeline mulai–tenggat dan beban kerja per orang | CR-0001 (addendum; blueprint R.02) |
| Report | Laporan progres, ketepatan waktu, task terlambat; export Excel/PDF; audit log | 3.2.8 |

## Out of Scope (butuh Change Request)
- Integrasi WhatsApp atau kanal notifikasi selain in-app dan email.
- Kanban/timeline di luar batasan CR-0001 (mis. sinkron kalender eksternal, Kanban yang melewati aturan status).
- Reminder berbasis hari (H-2 dan sejenisnya) — sudah digantikan reminder persentase.
- Reminder ke selain PIC.
- Role atau status baru; satu user dengan banyak role.
- Integrasi dengan SAP atau sistem lain.
- Aplikasi mobile native.
- Penghitungan akuntansi (ini manajemen task, bukan modul akuntansi).

## Aturan perubahan scope
Usulan baru → `docs/change-requests/CR-xxx.md` → disetujui pemilik proyek → blueprint naik versi → perbarui docs. Agent tidak boleh menyetujui CR.
