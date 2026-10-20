# CR-0002 — Pendaftaran akun, reset password, dan bootstrap Super Admin

- Pengusul: Pemilik proyek
- Tanggal: 2026-10-18
- Status: Disetujui — pendaftaran mandiri dan reset password; bootstrap Super Admin tetap menunggu

## Usulan
1. Tambahkan pendaftaran akun menggunakan email dan password. Email harus dikonfirmasi sebelum user dapat masuk. Trigger yang sudah ada membuat profil `Spectator`; user tidak dapat memilih atau mengubah role sendiri.
2. Tambahkan alur lupa/reset password melalui tautan email dengan redirect yang dibatasi ke URL aplikasi. Password baru hanya dapat diatur setelah token reset valid.
3. Sediakan prosedur bootstrap untuk Super Admin pertama:
   - Buat dan verifikasi akun melalui Supabase Dashboard menggunakan mailbox yang dikendalikan pemilik proyek.
   - Setelah trigger membuat profil `Spectator`, administrator database mempromosikan profil tersebut satu kali melalui Supabase SQL Editor.
   - Jangan menetapkan Super Admin otomatis hanya berdasarkan alamat email atau menyimpan password di SQL.
   - Setelah bootstrap, pemberian role berikutnya dilakukan melalui alur server-side sesuai FR-003/FR-004 dan dicatat di audit log sesuai NFR-003.

## Alasan dan hubungan dengan tujuan
Pendaftaran dan pemulihan password mengurangi hambatan akses. Prosedur bootstrap memastikan ada administrator awal yang dapat mengelola role, sambil mempertahankan aturan bahwa seluruh user baru mulai sebagai Spectator dan tidak dapat menaikkan hak akses sendiri.

## Dampak
- Scope: pendaftaran mandiri terbuka untuk alamat email apa pun dan pemulihan password ditambahkan ke modul akses; bootstrap Super Admin tetap menunggu persetujuan.
- Requirement: FR-001a/FR-001b dan layar Login diperbarui dengan acceptance criteria pendaftaran, konfirmasi email, dan reset password.
- Data model: tidak memerlukan role atau status baru untuk usulan dasar ini; gunakan tabel Auth dan profil `users` yang ada.
- Milestone: T-110 selesai pada M1; backlog dan `tasks/CURRENT.md` diperbarui.
- Konfigurasi: atur email confirmation dan redirect URL di Supabase; jangan commit `.env.local` atau key rahasia.
- Keamanan: verifikasi RBAC server-side, larang self-promotion, dan uji token reset/redirect serta pencatatan audit.

## Keputusan
Pemilik proyek menyetujui pendaftaran mandiri dan reset password. Bootstrap Super Admin tetap menunggu persetujuan.

### Amandemen untuk T-103 — provisioning user oleh administrator

- User berwenang dapat mengundang akun melalui Supabase Auth Admin API dan user baru tetap Spectator.
- `service_role` key hanya boleh dipakai server-side pada Server Actions/Route Handlers melalui `SUPABASE_SERVICE_ROLE_KEY`. Nilai tidak boleh diberi prefix `NEXT_PUBLIC_`, dikirim ke browser, dicatat ke log, atau dikomit.
- Undangan meminta user menetapkan kata sandi saat pertama kali membuka tautan undangan. Ini adalah aktivasi undangan, bukan alur reset password.
- User baru tetap dibuat sebagai Spectator. Penempatan awal mengikuti unit pada profil inviter; role dan section selanjutnya ditetapkan melalui T-104/T-105.
- Penonaktifan memperbarui status profil dan memblokir Auth sign-in/session melalui Supabase Auth Admin API serta middleware.
- Master Data Users hanya untuk Super Admin, GM, dan SM; SM dibatasi ke unitnya, sedangkan GM dan Super Admin memiliki cakupan lintas unit.
- Pendaftaran mandiri dan reset password tidak menggantikan alur undangan user berwenang.

### Implementasi pendaftaran dan pemulihan kata sandi

- Pendaftaran memakai email dan kata sandi; Supabase harus mewajibkan konfirmasi email sebelum login.
- Redirect email konfirmasi dan reset harus masuk ke URL aplikasi yang sudah diizinkan pada konfigurasi Supabase.
- Reset password memberi pesan generik agar tidak mengungkap apakah email terdaftar; perubahan password memerlukan sesi recovery dari tautan valid.
- Bootstrap Super Admin tetap mengikuti prosedur yang diusulkan pada butir 3 dan tidak dilakukan otomatis.
