# AGENTS.md — Aturan Kerja untuk AI Agent

Berlaku untuk semua agent (Claude Code, Codex, dll). Baca file ini sebelum mengubah apa pun.

## 1. Misi proyek (jangan diubah tanpa Change Request)
Membangun **Task Manager Department of Accounting**: satu tempat untuk melihat **siapa mengerjakan apa, timeline-nya, support yang dibutuhkan, dan evidence yang membuktikan task selesai**, dengan reminder berbasis persentase waktu dan hak akses per role.

Tujuan terukur ada di `docs/00-project-charter.md`. Semua pekerjaan harus bisa ditelusuri ke tujuan itu.

## 2. Sumber kebenaran (urutan prioritas)
1. `docs/source/Blueprint_Task_Manager_R01.pdf` — blueprint resmi versi R.01.
2. `docs/decisions/decision-log.md` — keputusan yang sudah dikonfirmasi pemilik proyek.
3. `docs/*.md` — turunan blueprint (scope, requirement, aturan bisnis, data model, dll).
4. Kode.

Jika dua sumber bertentangan: **berhenti**, catat di `docs/open-questions.md`, dan tanyakan ke pemilik proyek. Jangan memilih sendiri.

## 3. Pagar pembatas (hard guardrails)
Agent **tidak boleh**, tanpa Change Request yang disetujui (`docs/change-requests/`):
- Menambah fitur di luar `docs/01-scope.md` (lihat daftar Out of Scope, mis. WhatsApp, Kanban/timeline/Gantt, integrasi pihak ketiga).
- Menambah role, status task, atau kanal notifikasi baru. Role resmi: Spectator, Staff/PIC, Manager, SM, GM, Super Admin. Status resmi: To do, In progress, Blocked, Review, Revisi, Done.
- Mengubah aturan inti: satu user satu role; user baru = Spectator; Review butuh semua evidence wajib; Blocked butuh support; reminder hanya ke PIC; perubahan deadline oleh PIC butuh approval SM/GM/Super Admin.
- Memberi hak akses di luar `docs/03-roles-and-permissions.md`. Pengecekan hak akses wajib di sisi server, bukan hanya di UI.
- Memilih teknologi sebelum `docs/decisions/ADR-0001-tech-stack.md` berstatus **Accepted**.
- Mengarang data, nama orang, atau aturan yang tidak ada di dokumen. Tandai sebagai pertanyaan terbuka.

## 4. Cara kerja per task
1. Baca `tasks/CURRENT.md`. Kerjakan **hanya** task yang tercantum di sana (WIP limit = 1 task aktif).
2. Cari ID terkait: `FR-xxx` (kebutuhan), `BR-xxx` (aturan bisnis), `NFR-xxx`. Setiap perubahan kode harus menyebut minimal satu ID.
3. Tulis tes dari acceptance criteria di `docs/02-requirements.md` lebih dulu atau bersamaan dengan kode.
4. Ubah seminimal mungkin. Jangan refactor, rename, atau "sekalian perbaiki" hal yang tidak diminta task.
5. Jalankan agent pemeriksa (`.claude/agents/`) yang relevan: `scope-guardian` selalu, ditambah `rbac-reviewer`, `rules-verifier`, atau `data-model-reviewer` sesuai area.
6. Perbarui `docs/traceability.md` dan status task. Jika ada keputusan baru, catat di `docs/decisions/`.
7. Selesai hanya jika memenuhi `docs/09-definition-of-done.md`.

## 5. Kapan harus berhenti dan bertanya
- Requirement ambigu atau ada di `docs/open-questions.md`.
- Ide yang "akan lebih bagus" tapi tidak ada di scope. Catat sebagai usulan di `docs/change-requests/`, jangan dikerjakan.
- Task membutuhkan perubahan di luar milestone aktif.
- Hasil agent pemeriksa menyatakan DRIFT.

## 6. Konvensi
- Dokumen berbahasa Indonesia. Kode, nama tabel/kolom, dan pesan commit berbahasa Inggris.
- Commit: `FR-020: create task with owner and timeline` (awali dengan ID).
- Branch: `m<milestone>/<T-id>-<slug>`, contoh `m2/T-210-task-crud`.
- Satu PR = satu task. Gunakan `.github/PULL_REQUEST_TEMPLATE.md`.
- Nama kolom dan tabel mengikuti `docs/05-data-model.md`.

## 7. Kontrol perubahan scope
Perubahan scope hanya lewat Change Request (`docs/change-requests/CR-xxx.md`) yang disetujui pemilik proyek, lalu blueprint dinaikkan versinya (R.02, dst) dan `docs/` diperbarui. Agent **tidak boleh menyetujui CR sendiri**.
