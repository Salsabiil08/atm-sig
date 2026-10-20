# CR-0003 — Pembuatan Task Otomatis dari Template Rutin

- Pengusul: pemilik proyek melalui jawaban OQ-05 (2026-10-20)
- Status: **Disetujui pemilik proyek (2026-10-20)**
- Terkait: FR-100, M5 / T-505

## Latar belakang

Scope saat ini memasukkan master kategori dan template task rutin, tetapi secara eksplisit mengecualikan pembuatan task rutin otomatis. Pemilik proyek mengarahkan agar template juga dapat membuat task secara berkala. Perubahan ini memperluas scope dan membutuhkan persetujuan CR sebelum scheduler atau pembentukan task otomatis dibangun.

## Perubahan yang diusulkan

- Master kategori dan template task tetap mendukung CRUD oleh role yang berwenang.
- Template dapat dijadwalkan untuk membuat task baru secara otomatis.
- Setiap task hasil jadwal tetap mengikuti validasi, scope organisasi, role, status awal, notifikasi PIC, dan audit yang berlaku pada pembuatan task biasa.
- Eksekusi jadwal harus idempoten agar retry tidak menggandakan task.

## Keputusan operasional

Pemilik proyek menyetujui aturan awal berikut pada 2026-10-20 (D-034):

1. Frekuensi mingguan atau bulanan, diproses pukul 08.00 WIB (Asia/Jakarta). Untuk tanggal 29–31 pada bulan yang lebih pendek, gunakan hari terakhir bulan itu (D-035).
2. Jadwal terlewat dilewati dan tidak dibuat susulan.
3. Perubahan template hanya berlaku untuk task yang akan dibuat berikutnya; task yang sudah terbuat tidak berubah.
4. PIC, reviewer, dan offset tanggal mulai/tenggat disimpan pada template dan diwariskan saat task dibuat.

## Dampak

Scope, FR-100, model data, layar, dan arsitektur sudah diperbarui. Implementasi scheduler server-side, pencatatan eksekusi idempoten, kontrol RBAC, dan audit trail tersedia; verifikasi otomatis tetap menjadi bagian DoD T-505.

## Persetujuan

Disetujui pemilik proyek melalui jawaban eksplisit pada 2026-10-20.
