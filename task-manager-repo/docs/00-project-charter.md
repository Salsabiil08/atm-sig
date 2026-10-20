# 00 — Project Charter

Versi dokumen: 0.1 · Tanggal: 2026-10-16 · Sumber: Blueprint R.01 bagian 1–3

## Masalah
Task di Department of Accounting banyak dan beragam (verifikasi, rekonsiliasi, akuntansi biaya, pelaporan internal dan eksternal). Pimpinan dan pelaksana sulit mengetahui task mana yang belum selesai, siapa pemegangnya, kapan tenggatnya, support apa yang dibutuhkan, dan bukti apa yang menunjukkan task selesai. Risiko: task terlewat dan terlambat, terutama saat closing.

## Tujuan
1. Satu tempat pencatatan task: siapa mengerjakan apa, timeline, support, evidence.
2. Mengurangi task terlewat dan keterlambatan lewat reminder berbasis persentase waktu.
3. Mempercepat pemantauan progres oleh Manager, SM, GM, dan Super Admin.
4. Akuntabilitas: hak akses per role, review atasan, approval perubahan deadline, audit log.

## Ukuran keberhasilan (acuan UAT)
| ID | Ukuran | Cara uji |
|---|---|---|
| S-1 | Tidak ada task berstatus Review/Done tanpa semua evidence wajib terunggah | Uji otomatis atas aturan BR-020 |
| S-2 | Setiap task aktif menampilkan PIC, timeline, support, dan evidence di satu layar | UAT layar Detail Task |
| S-3 | Reminder 50/80/90% terkirim tepat satu kali per checkpoint dan hanya ke PIC | Uji scheduler dengan jam tiruan |
| S-4 | Manager, SM, GM, Super Admin menerima notifikasi atas tanggapan dan progress PIC | UAT notifikasi |
| S-5 | Tidak ada aksi di luar hak akses role (uji dari API, bukan hanya UI) | Uji matriks role |
| S-6 | Perubahan deadline oleh PIC tidak berlaku sebelum disetujui | Uji alur BR-040 |

## Pemangku kepentingan (peran, bukan nama)
General Manager (pemilik proses) · SM of Accounting · SM of Reporting · Manager per section · Staff/PIC · Super Admin · Penyusun/Project Manager.

## Batasan
- Struktur organisasi: 2 unit, 7 section (Accounting 5, Reporting 2).
- Satu user satu role.
- Teknologi belum dipilih; keputusan lewat ADR-0001.

## Di luar tujuan
Lihat `docs/01-scope.md` bagian Out of Scope.
