# 03 — Role dan Hak Akses

Sumber: Blueprint R.01 bagian 5 (Table 3) dan decision log D-001..D-010.

## Role
Spectator · Staff/PIC · Manager (per section) · SM / Senior Manager (per unit) · GM / General Manager · Super Admin. Satu user = satu role + satu penempatan (unit/section).

Penetapan mengikuti level organisasi: Staff/PIC dan Manager pada section, SM pada unit, serta GM dan Super Admin pada department. Spectator dapat ditempatkan di level organisasi mana pun. Staff/PIC wajib memiliki Manager pada section yang sama; Manager wajib memiliki SM pada unit induk section; SM wajib memiliki GM pada department induk unit. Atasan harus aktif. Spectator, GM, dan Super Admin tidak memiliki atasan langsung.

## Matriks
| Role | Lihat data | CRUD task | Pindah task ke | Ubah role | Approval deadline | Di-review oleh |
|---|---|---|---|---|---|---|
| Spectator | Read-only pada penempatan dan seluruh unit turunannya | Tidak | Tidak | Tidak | Tidak | - |
| Staff/PIC | Task miliknya dan section-nya | Ya (dalam cakupan) | Tidak | Tidak | Tidak (mengajukan) | Manager |
| Manager | Section-nya | Ya | Staff/PIC di section-nya | Tidak | Tidak | SM |
| SM | Unit-nya | Ya | Manager dan Staff di unitnya | Tidak dapat menetapkan langsung | Ya | GM |
| GM | Seluruh departemen | Ya | SM, Manager, Staff | Mengusulkan perubahan | Ya | Tidak ada reviewer (D-015) |
| Super Admin | Semua | Ya | Semua role | Semua role dan penempatan | Ya | Tidak ada reviewer (D-015) |

BR-061 juga ditegakkan oleh RLS: Spectator tidak dapat mengubah profilnya, menulis task, atau mengubah notifikasi melalui Supabase API langsung. Kebijakan tulis master role dan organisasi hanya mengizinkan Super Admin.
Perubahan profil/role dilakukan melalui Server Actions server-side yang diaudit; authenticated client, termasuk Super Admin, tidak dapat menulis profil atau mengubah audit log secara langsung (NFR-003, D-026).

Cakupan task ditegakkan di query server dan RLS: Spectator hanya membaca penempatannya dan seluruh unit turunannya; Manager pada section penempatannya; SM pada unit dan section turunannya; GM/Super Admin lintas departemen; PIC dan reviewer dapat membaca task yang ditugaskan kepada mereka. Perubahan pada entitas terkait (WBS, evidence, support, komentar, reminder, pengajuan deadline, dan riwayat assignment) mengikuti cakupan task induknya. Halaman Dashboard hanya untuk Manager ke atas, Master Data Users hanya untuk SM ke atas.

## Aturan lintas role
- **PR-1** Pengecekan hak akses dilakukan di server untuk setiap endpoint, termasuk filter cakupan data berdasarkan hirarki organisasi.
- **PR-2** Manager Verification 1 tidak boleh mengubah task Cost Accounting; SM Reporting tidak boleh mengubah task Unit Accounting (cakupan unit/section).
- **PR-3** User baru otomatis Spectator; Super Admin menetapkan role dan penempatan. GM dapat mengusulkan perubahan; SM tidak dapat menetapkan role langsung.
- **PR-4** Setiap perubahan role tercatat di audit log (siapa, kapan, nilai lama, nilai baru).
- **PR-5** Review: Manager me-review Staff/PIC, SM me-review Manager, GM me-review SM. Task milik GM dan Super Admin tidak memiliki reviewer (D-015).
- **PR-6** Manager, SM, GM, Super Admin mengubah deadline langsung lewat CRUD; hanya Staff/PIC yang memerlukan approval.

## Penerima notifikasi
Lihat BR-035 di `docs/04-business-rules.md`.
