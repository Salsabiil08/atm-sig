# Aktivasi push scheduler setelah rilis

Push notification menggunakan `public.notifications -> enqueue_notification_push -> public.push_deliveries -> /api/cron/push`.

## Mengapa menggunakan Supabase Cron?
Vercel Hobby hanya menjamin jadwal sekali sehari, bukan pengiriman mendekati real-time. Supabase pg_cron + pg_net bisa memanggil endpoint setiap menit; rilis baru dijalankan setelah validasi end-to-end. Tidak boleh ada dua scheduler aktif untuk endpoint ini.

## Checklist prasyarat
- Draft PR sudah lulus CI/UAT, merged, deploy production READY.
- Tiga VAPID env vars valid untuk production; private key yang pernah dibagikan telah dirotasi.
- CRON_SECRET sama antara Vercel production dan Supabase Vault; jangan tempel rahasia ke kode.
- Domain production HTTPS telah dapat diakses dari luar (periksa Vercel Deployment Protection dan respons 401 vs halaman SSO).
- Migration push tables/functions telah diterapkan dan service-role client valid.
- Satu scheduler resmi saja.

## SQL yang dijalankan manual sesudah deployment
Aktifkan pg_cron dan pg_net lewat Dashboard > Database > Extensions. Simpan dua nilai lewat Database > Vault:
- `atm_push_app_url`: https://atm-sig.vercel.app
- `atm_push_cron_secret`: nilai CRON_SECRET persis dari Vercel, disimpan sebagai secret Vault.

Setelah kedua Vault secrets ada:

```sql
select cron.schedule(
  'atm-push-queue',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='atm_push_app_url') || '/api/cron/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='atm_push_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
```

Periksa:
```sql
select jobid,jobname,schedule,active from cron.job where jobname='atm-push-queue';
select status,return_message,start_time from cron.job_run_details
where jobid in (select jobid from cron.job where jobname='atm-push-queue')
order by start_time desc limit 10;
```

Untuk hentikan sementara `select cron.unschedule('atm-push-queue');`

**Belum dijalankan otomatis**: aktifkan hanya setelah rilis production selesai dan privasi/security diverifikasi.
