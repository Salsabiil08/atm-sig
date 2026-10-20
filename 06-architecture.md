# 06 — Arsitektur

Sumber: Blueprint R.02 bagian 4.1 dan ADR-0001. Stack: Next.js, Vercel, PostgreSQL di Supabase.

## Komponen
- **Aplikasi Web Accounting Task Manager (Next.js)** — satu aplikasi, satu server (Vercel). Antarmuka web dan logika server (termasuk RBAC) berada dalam aplikasi yang sama; **tidak ada lapisan API yang menghubungkan frontend dan backend** (D-022).
- **User Management (T-103)** — undangan dan pemblokiran akun memakai Supabase Auth Admin API hanya dari Server Actions/Route Handlers. Kredensial administratif disimpan sebagai secret server-only; undangan ditangani oleh route konfirmasi dan halaman aktivasi kata sandi pertama.
- **Database Task** — PostgreSQL di Supabase; model pada `docs/05-data-model.md`. Nama "Database Task" dipakai konsisten di semua diagram.
- **RBAC dan cakupan organisasi (T-106, T-108)** — middleware membatasi halaman Dashboard untuk Manager ke atas dan Master Data Users untuk SM ke atas. Query server menambahkan filter cakupan; RLS menjadi penegakan untuk API langsung dengan Spectator hanya membaca penempatan dan turunannya, Manager pada section, SM pada unit dan section turunannya, GM/Super Admin lintas organisasi, serta akses PIC/reviewer pada task terkait.
- **Task CRUD (T-201)** — Server Actions memvalidasi input task; pembuatan, pembaruan, dan penghapusan task dibatasi lagi oleh RLS berbasis role dan penempatan. Penghapusan hanya untuk Manager ke atas dalam cakupan organisasi mereka.
- **Support task (T-202)** — PIC mengajukan support untuk penerima aktif; hanya penerima yang dapat menyelesaikan permintaan sekali, dan RLS serta validasi database mencegah perubahan konten atau akses di luar cakupan task.
- **File Storage Evidence** — penyimpanan file evidence dengan kontrol akses (NFR-005).
- **Scheduler Reminder** — job berkala untuk checkpoint (BR-030..BR-038); memanggil endpoint internal aplikasi.
- **Layanan Notifikasi** — in-app dan email.

## Prinsip
1. Aturan bisnis (status, checkpoint, approval) berada di sisi server aplikasi, bukan di komponen UI.
2. Hak akses diperiksa di setiap Server Action, Route Handler, dan query data (NFR-001).
   RLS PostgreSQL menegakkan cakupan hierarki yang sama sebagai lapisan pertahanan API; Spectator hanya dapat membaca penempatan dan turunannya, Manager tidak dapat menulis lintas section dan SM tidak dapat menulis lintas unit (PR-2).
3. Scheduler idempoten dan dapat diuji dengan jam tiruan; endpoint scheduler diamankan.
4. Tidak ada komponen di luar daftar di atas tanpa ADR dan Change Request bila menambah scope.
5. Kunci rahasia dan konfigurasi tidak dikomit ke repo.
6. `SUPABASE_SERVICE_ROLE_KEY` tidak pernah diekspos ke browser atau diberi prefix `NEXT_PUBLIC_`; aksesnya dibatasi pada operasi user management yang memerlukannya.
