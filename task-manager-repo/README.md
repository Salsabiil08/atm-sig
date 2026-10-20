# Task Manager — Department of Accounting

Aplikasi web untuk mencatat dan memantau task di Department of Accounting: **siapa mengerjakan apa, timeline, support yang dibutuhkan, dan evidence penyelesaian**, dengan reminder berbasis persentase waktu dan hak akses per role.

- Sumber resmi: `docs/source/Blueprint_Task_Manager_R01.pdf` (versi R.01, Oktober 2026)
- Status: **Pra-implementasi** — stack teknologi belum diputuskan (lihat `docs/decisions/ADR-0001-tech-stack.md`)

## Peta dokumen

| Kebutuhan | Buka |
|---|---|
| Tujuan dan ukuran keberhasilan | `docs/00-project-charter.md` |
| Apa yang termasuk dan tidak termasuk | `docs/01-scope.md` |
| Daftar kebutuhan + acceptance criteria | `docs/02-requirements.md` |
| Role dan hak akses | `docs/03-roles-and-permissions.md` |
| Aturan bisnis (status, reminder, deadline) | `docs/04-business-rules.md` |
| Model data | `docs/05-data-model.md` |
| Arsitektur | `docs/06-architecture.md` |
| Daftar layar | `docs/07-ui-screens.md` |
| Roadmap dan milestone | `docs/08-roadmap.md` |
| Definition of Done | `docs/09-definition-of-done.md` |
| Istilah | `docs/10-glossary.md` |
| Keputusan terkonfirmasi | `docs/decisions/decision-log.md` |
| Pertanyaan terbuka | `docs/open-questions.md` |
| Keterlacakan blueprint → kebutuhan → milestone | `docs/traceability.md` |
| Task aktif dan backlog | `tasks/CURRENT.md`, `tasks/BACKLOG.md` |
| Aturan untuk AI agent | `AGENTS.md`, `.claude/agents/` |

## Cara menjaga proyek tetap sesuai tujuan
1. Hanya satu milestone dan satu task aktif (`tasks/CURRENT.md`).
2. Setiap perubahan menyebut ID kebutuhan (`FR-xxx`) atau aturan (`BR-xxx`).
3. Fitur baru hanya lewat Change Request (`docs/change-requests/`).
4. Setiap PR melewati pemeriksaan `scope-guardian` dan Definition of Done.
