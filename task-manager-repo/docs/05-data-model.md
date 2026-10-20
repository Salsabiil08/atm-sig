# 05 — Model Data

Sumber: Blueprint R.01 bagian 4.2 (Gambar 2–4). Tipe data dan PK/FK final ditentukan setelah ADR-0001; **nama tabel dan kolom di bawah tidak diubah tanpa memperbarui dokumen ini**.

| Tabel | Kolom | Catatan |
|---|---|---|
| roles | id, name, level | 6 role resmi (seed) |
| org_units | id, parent_id, name, type | type: department, unit, section; seed 2 unit, 7 section |
| users | id, name, email, role_id, org_unit_id, supervisor_id, status | satu role per user (BR-060); supervisor_id menentukan reviewer dan penerima notifikasi |
| tasks | id, owner_id, assigner_id, reviewer_id, org_unit_id, parent_task_id, category_id, title, priority, status, progress_pct, start_date, due_date, completed_at | status mengikuti BR-001; reviewer_id wajib menunjuk supervisor aktif dengan role satu tingkat di atas PIC, kecuali PIC GM/Super Admin yang wajib tanpa reviewer (BR-070, D-015); kategori opsional; task hasil template menyimpan kategori saat dibuat |
| task_categories | id, org_unit_id, name, is_active, created_at | kategori master berada pada section yang mengelolanya; kategori nonaktif tetap tersimpan untuk histori; cakupan hanya dapat dibaca/dikelola role berwenang dalam scope dan tidak dapat dipindah setelah dibuat (D-032) |
| task_templates | id, org_unit_id, category_id, name, title, priority, owner_id, reviewer_id, recurrence, recurrence_day, start_offset_days, due_offset_days, is_active, next_run_at, created_by, created_at, updated_at | snapshot penugasan task baru untuk jadwal mingguan/bulanan; SM terbatas unitnya, GM/Super Admin lintas unit (D-032..D-034) |
| task_template_runs | id, template_id, scheduled_for, task_id, outcome, created_at | satu catatan per template/jadwal; unique(template_id, scheduled_for) untuk idempotensi; task hasil tidak berubah saat template diedit |
| task_reassignments | id, task_id, from_user_id, to_user_id, reason, created_at | riwayat BR-051; perubahan owner dilakukan atomik melalui fungsi pemindahan task |
| task_progress_history | id, task_id, changed_by, progress_pct, created_at | riwayat progress append-only; setiap perubahan progress oleh PIC dicatat |
| task_supports | id, task_id, needed_from_id, description, status | status: diminta/diberikan |
| task_comments | id, task_id, user_id, body | juga dipakai komentar reviewer |
| evidence_requirements | id, task_id, description, mandatory | |
| task_evidence | id, requirement_id, uploader_id, file_or_link, uploaded_at | file_or_link berisi tautan HTTPS atau path pada bucket privat |
| task_reminders | id, task_id, checkpoint_pct, sent_at, response, responded_at, due_date_version | satu baris per checkpoint per versi deadline (BR-037) |
| deadline_change_requests | id, task_id, requested_by, old_due_date, new_due_date, reason, status, approver_id, decided_at | status: Menunggu approval, Disetujui, Ditolak; hanya PIC aktif task yang dapat membuat pengajuan; alasan 1–1000 karakter; permintaan tidak mengubah deadline task |
| notifications | id, user_id, task_id, reminder_id, type, title, body, sent_at, read_at | satu notifikasi reminder menaut ke reminder sumber; task baru/pemindahan mengirim `task_assigned` kepada PIC; type lain mengacu pada BR-035 |
| task_reminder_email_deliveries | reminder_id, claimed_at, sent_at, attempts | antrean internal tanpa akses authenticated; lease retry Resend 72 jam |
| audit_logs | id, user_id, action, object, old_value, new_value | tidak dapat diubah dari aplikasi; trigger deadline langsung mencatat perubahan atomik dengan update task |
| role_change_requests | id, target_user_id, requested_by, requested_role_id, requested_org_unit_id, requested_supervisor_id, status, decided_by, decided_at, created_at | usulan GM; hanya Super Admin yang dapat memutuskan (FR-004, D-024); satu usulan pending per target |

## Hubungan utama
roles 1–N users · org_units 1–N users dan tasks (self-reference lewat parent_id) · org_units 1–N task_categories dan task_templates · task_categories 1–N task_templates dan tasks · task_templates 1–N task_template_runs · task_template_runs 0..1 task · users 1–N tasks (owner, assigner, reviewer) · tasks 1–N reassignments, progress_history, supports, comments, evidence_requirements, reminders, deadline_change_requests, notifications · evidence_requirements 1–N task_evidence · users 1–N reassignments (PIC asal/tujuan), progress_history, notifications, audit_logs, dan role_change_requests.

File evidence disimpan di bucket privat Supabase Storage `task-evidence`, terpisah dari database. Path file mengikat ID task dan persyaratan evidence; akses file memakai RLS dan URL unduhan bertanda tangan yang singkat. Batas implementasi saat ini 20 MB per file untuk PDF, JPG, PNG, dan CSV. Masa simpan masih mengikuti OQ-10 dan belum diputuskan.

## Penambahan kolom/tabel
Boleh hanya jika: (1) ada ID FR/BR yang membutuhkannya, (2) dokumen ini diperbarui di PR yang sama, (3) `data-model-reviewer` menyatakan selaras.
