# ADR-0001 — Pemilihan teknologi

- Status: **Accepted**
- Tanggal: 2026-10-16
- Pemutus: Huda (Akuntansi SIG), melalui pesan 2026-10-16 pukul 15:05–15:07; pemilik proyek

## Konteks
Blueprint menyerahkan pemilihan teknologi ke tim pengembang. Kebutuhan teknis yang mempengaruhi pilihan: RBAC di server (NFR-001), scheduler idempoten (FR-058), unggah evidence (FR-024), email (FR-056), export Excel/PDF (FR-091), audit log (FR-092). Antarmuka dan logika server **tidak dipisah server** (D-022).

## Keputusan
| Topik | Keputusan | Status |
|---|---|---|
| Framework | **Next.js** — satu aplikasi full-stack; antarmuka dan logika server berada dalam satu aplikasi dan satu server | Diputuskan |
| Deployment | **Vercel** | Diputuskan |
| Database | **PostgreSQL di Supabase** | Diputuskan |

Karena tidak ada server backend terpisah, **tidak ada lapisan API antara frontend dan backend**. Route Handler atau Server Action hanya dipakai sebagai bagian internal aplikasi, bukan API publik yang dirancang tersendiri (kecuali endpoint yang dibutuhkan scheduler).

## Belum diputuskan (tidak boleh diputuskan sendiri oleh agent)
| Topik | Usulan untuk dipertimbangkan | Terkait |
|---|---|---|
| Bahasa | TypeScript | - |
| Akses data (ORM/query builder) | (belum ada usulan) | - |
| Autentikasi | (belum ada usulan; akun lokal atau SSO) | OQ-08 |
| Penyimpanan evidence | Supabase Storage | OQ-10 |
| Scheduler reminder | Vercel Cron atau pg_cron di Supabase | OQ-18 |
| Email | (belum ada usulan) | OQ-07 |
| Pengujian dan CI | (belum ada usulan) | T-002 |

## Konsekuensi dan risiko yang perlu diperhatikan
1. **RBAC di setiap titik akses.** Karena tidak ada API terpisah, setiap Server Action, Route Handler, dan query data harus memeriksa role dan cakupan organisasi (NFR-001, PR-1). Pertimbangkan Row Level Security Supabase sebagai lapisan pertahanan tambahan.
2. **Scheduler.** Vercel Cron pada paket Hobby hanya dapat berjalan sekali per hari dan waktunya tidak presisi; per menit tersedia di paket Pro. Checkpoint 50/80/90% (terutama untuk timeline pendek) membutuhkan frekuensi lebih tinggi. Cron berjalan dalam UTC, hanya di production, dan memanggil endpoint lewat HTTP GET, sehingga endpoint wajib diamankan dan idempoten (FR-058, BR-037). Verifikasi ulang batas paket di dokumentasi Vercel saat memilih paket.
3. **Unggah evidence.** Vercel Functions membatasi ukuran body request (sekitar 4,5 MB; Server Actions bawaan lebih kecil). Unggah file sebaiknya langsung dari browser ke storage lewat signed URL, bukan melewati fungsi server.
4. **Koneksi database serverless.** Gunakan connection pooler Supabase agar koneksi tidak habis pada fungsi serverless.
5. **Data di layanan pihak ketiga.** Data akuntansi berada di Vercel dan Supabase; pastikan sesuai kebijakan keamanan data perusahaan (OQ-18). Periksa pula ketentuan penggunaan dan biaya paket yang dipilih.
6. **Agent** tidak boleh menyimpang dari keputusan ini tanpa ADR baru.
