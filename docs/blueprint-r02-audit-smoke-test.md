# Audit & smoke-test plan — Blueprint ATM R.02 (2026-10-21)

Source of truth: Blueprint_Accounting_Task_Manager_R02.pdf (24 pages), with audit report 2026-10-21 as historical evidence only. **Not a production UAT sign-off.**

## Acceptance checklist

| ID | Test | Expected |
|---|---|---|
| RBAC-01 | New user logs in | Spectator; cannot read any business data or invoke business RPC |
| RBAC-02 | Staff/PIC creates own task | Owner=self, reviewer=direct manager, status=To do |
| RBAC-03 | PIC attempts assign another owner/cross-section | Rejected by server and RLS |
| TASK-01 | Manager+ creates task | Category, WBS, priority, timeline, support, mandatory evidence captured |
| TASK-02 | Complete leaf WBS | Progress recalculated; history saved |
| TASK-03 | Blocked without support | Rejected; with support notifies support owner |
| TASK-04 | Request Review with missing mandatory evidence | Rejected |
| TASK-05 | Manager reviews PIC / SM reviews Manager / GM reviews SM | Only designated reviewer allowed; reject requires reason |
| TASK-06 | Reassign within scope | Mandatory reason, audit history, new PIC notified |
| DATE-01 | Due 21 Oct 2026, clock 21 Oct 18:00 WIB | Not overdue |
| DATE-02 | Due 21 Oct 2026, clock 22 Oct 00:00 WIB | Overdue unless Done |
| DATE-03 | Approve deadline change | SM/GM/SA only; recompute checkpoint, notify requester |
| REM-01 | Time checkpoints 50/80/90 | PIC-only reminder, no duplicates |
| REM-02 | Short task under 24h | WBS progress-based checkpoint logic |
| REM-03 | Scheduler and email | Verified invocation, CRON_SECRET, sender, no duplicate deliveries |
| UI-01 | Dashboard, job load, task list, Kanban, timeline | Correct filters and role-scoped data |
| UI-02 | User management, role changes | Audit recorded; role/scope enforced |
| UI-03 | Reports, Excel/PDF, audit log | Role-scoped and correct WIB dates |
| PUSH-01 | Install PWA and explicitly opt in | Permission prompt only on user gesture |
| PUSH-02 | Send task notification | Only recipient's active subscription; works with app closed where browser permits |
| PUSH-03 | Sign out / revoke permission | No further push delivered to revoked endpoint |
| PUSH-04 | Unsupported browser/device | In-app and email remain usable |

## Findings from independent report, not revalidated yet

P0: overexposed SECURITY DEFINER RPCs; scheduler secrets/config.
P1: PIC self-create, WIB deadline semantics, evidence editor at creation, edit/delete/reassign UI, WBS editor, transactional audit.
P2: dialog accessibility, mobile timeline, query efficiency.

## Safe execution policy

- Use preview/staging and test accounts for destructive/write smoke tests.
- Never run permission/role bypass probes against production without authorization and a rollback plan.
- Verify database privileges before revoking; avoid blanket REVOKE.
- Do not claim PASS based solely on presence of source code.
- Do not merge until automated tests, browser-based six-role UAT, and push test on installed devices are evidenced.
