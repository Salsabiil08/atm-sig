# ADR-0001 — Pemilihan teknologi

- Status: **Accepted**
- Tanggal diputuskan: 2026-10-16
- Pemutus: Huda (Akuntansi SIG), pemilik proyek — via pesan 2026-10-16 pukul 15:05–15:07; dikonfirmasi ulang 2026-10-18

## Konteks
Blueprint R.01 bagian 4.1 hanya menetapkan komponen logis (frontend web, backend API + RBAC, database, file storage, scheduler, layanan notifikasi). Kebutuhan teknis yang mempengaruhi pilihan: RBAC di server (NFR-001), scheduler idempoten (FR-058), upload evidence (FR-024), email (FR-056), export Excel/PDF (FR-091), audit log (FR-092). Arsitektur tidak memisahkan frontend dan backend ke server berbeda (D-022).

## Keputusan
| Topik | Keputusan | Catatan |
|---|---|---|
| Framework (full-stack) | **Next.js 16** (App Router) | Satu aplikasi; antarmuka dan logika server dalam satu server (D-022). Tidak ada API layer terpisah antara frontend dan backend; Route Handler/Server Action hanya untuk keperluan internal atau endpoint scheduler |
| Bahasa | **TypeScript** | Dipakai di seluruh kode aplikasi |
| Hosting/deployment | **Vercel** | Region kandidat: `ap-southeast-1` (Singapura) |
| Database | **PostgreSQL di Supabase** | Gunakan connection pooler Supabase untuk fungsi serverless |
| Autentikasi | **Supabase Auth — email/password** | MVP; SSO tidak dibangun kecuali ada CR disetujui (OQ-08 terjawab) |
| File storage evidence | **Supabase Storage** — bucket private | Kontrol akses berbasis role/unit/section; max 20 MB/file; format PDF/XLSX/DOCX/JPG/JPEG/PNG; tanpa retensi/hapus otomatis (OQ-10 terjawab) |
| Scheduler reminder | **Supabase Cron** | Satu scheduler tunggal untuk reminder, eskalasi email 72 jam, dan task rutin; idempoten (OQ-18 terjawab) |
| Pengiriman email | **Resend HTTPS API** | Email reminder hanya dikirim setelah 72 jam kalender tanpa respons; bukan untuk notifikasi awal (OQ-07 terjawab) |
| Notifikasi in-app/push | **In-app notification + Web Push** | Kanal utama; email hanya untuk eskalasi |

## Konsekuensi dan risiko
1. **RBAC di setiap titik akses.** Setiap Server Action, Route Handler, dan query data wajib memeriksa role dan cakupan organisasi (NFR-001, PR-1). Row Level Security Supabase sebagai lapisan pertahanan tambahan.
2. **Scheduler tunggal.** Supabase Cron menangani semua job periodik; jangan membuat Vercel Cron kedua untuk pekerjaan yang sama.
3. **Unggah evidence.** Upload file langsung dari browser ke Supabase Storage via signed URL — tidak melalui fungsi server (batas body ~4,5 MB pada Vercel Functions).
4. **Koneksi database serverless.** Wajib menggunakan connection pooler Supabase.
5. **Kunci rahasia.** API key, Supabase URL/anon key, Resend API key disimpan hanya di environment server; tidak pernah dikomit ke repo.
6. **Agent tidak boleh menyimpang dari keputusan ini** tanpa ADR baru yang disetujui pemilik proyek.

## Aturan
ADR ini berstatus Accepted. Agent **boleh mulai menulis kode aplikasi** mengikuti keputusan di atas. Perubahan stack hanya lewat ADR baru.
