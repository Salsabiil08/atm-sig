# CR-0001 — Tampilan Kanban dan Timeline

- Pengusul: tim proyek (menu "Kanban" muncul di mockup Blueprint R.01, Gambar 15 dan 18, namun tidak ada di daftar fungsi 3.2)
- Tanggal: 2026-10-16
- Status: **Disetujui** oleh pemilik proyek (2026-10-16, jawaban OQ-06: "Boleh")
- Tindak lanjut: blueprint dinaikkan ke R.02 memuat addendum ini; sampai terbit, CR ini berlaku sebagai addendum R.01

## Usulan
1. **Kanban** (FR-110): papan task dengan kolom per status.
2. **Timeline** (FR-111): tampilan bar mulai–tenggat per task untuk melihat tenggat dan beban kerja per orang.

## Hubungan dengan tujuan
Mendukung tujuan 3 (pemantauan progres lebih cepat) dan tujuan 1 (melihat siapa mengerjakan apa dan kapan).

## Batasan (agar tidak melebar)
- Kanban tidak boleh melewati aturan status: pemindahan kartu memakai validasi BR-001, BR-002, BR-020, BR-021 dan hak akses yang sama dengan jalur lain.
- Cakupan data mengikuti role (NFR-002).
- Hanya dua tampilan di atas; tidak ada sinkron kalender eksternal atau fitur baru lain.
- Mockup harus disetujui pemilik proyek sebelum dibangun (T-506, OQ-14).

## Dampak
Scope (`docs/01-scope.md`), requirement FR-110 dan FR-111, layar baru di `docs/07-ui-screens.md`, milestone M5.

## Keputusan rinci (2026-10-16, D-020)
- Kolom Kanban mengikuti enam status blueprint.
- Semua role yang berhak mengubah task boleh memindahkan kartu dalam cakupannya (Spectator hanya melihat); aturan status tetap berlaku.
- Staff/PIC yang mengganti deadline atau timeline harus diizinkan SM/GM/Super Admin (BR-040/BR-081).
- Belum diputuskan: bentuk timeline (Gantt bar atau kalender) dan definisi beban kerja per orang (OQ-14).