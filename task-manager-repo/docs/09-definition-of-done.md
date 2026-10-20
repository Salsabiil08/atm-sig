# 09 — Definition of Done

Task dinyatakan selesai hanya bila **semua** terpenuhi:

1. Perubahan menyebut ID `FR-`/`BR-`/`NFR-` yang relevan di commit dan PR.
2. Semua acceptance criteria di `docs/02-requirements.md` untuk ID tersebut punya tes otomatis yang lulus.
3. Tidak ada perubahan di luar cakupan task (diff diperiksa `scope-guardian` → ALIGNED).
4. Jika menyentuh hak akses: `rbac-reviewer` → PASS, dan ada tes yang memanggil API langsung dengan role tidak berwenang.
5. Jika menyentuh status, reminder, atau deadline: `rules-verifier` → PASS.
6. Jika menyentuh skema data: `data-model-reviewer` → ALIGNED dan `docs/05-data-model.md` diperbarui.
7. `docs/traceability.md` dan `tasks/CURRENT.md` diperbarui.
8. Tidak ada data uji berisi data pribadi sungguhan; tidak ada rahasia di repo.
9. Pesan error dan teks UI berbahasa Indonesia, konsisten dengan blueprint.
10. Pertanyaan baru yang muncul sudah dicatat di `docs/open-questions.md`.
