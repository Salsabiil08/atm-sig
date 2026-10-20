import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendReminderEmail, type ReminderEmail } from './email'

const reminder: ReminderEmail = {
  reminder_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  task_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  owner_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  owner_email: 'pic@example.test',
  task_title: 'Reconciliation review',
  checkpoint_pct: 80,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendReminderEmail (FR-056, ADR-0001)', () => {
  it('sends a plain-text Resend request to the PIC with a stable idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendReminderEmail(reminder, 'resend-secret', 'ATM <noreply@example.test>'))
      .resolves.toEqual({ ok: true, status: 200 })
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer resend-secret',
        'Content-Type': 'application/json',
        'Idempotency-Key': `task-reminder-${reminder.reminder_id}`,
      },
      body: JSON.stringify({
        from: 'ATM <noreply@example.test>',
        to: ['pic@example.test'],
        subject: 'Reminder 80%: Reconciliation review',
        text: [
          'Task "Reconciliation review" telah melewati checkpoint 80%.',
          'Reminder ini belum mendapat tanggapan selama 72 jam kalender.',
          'Silakan buka aplikasi Task Manager Accounting untuk memperbarui progres atau menanggapi reminder.',
        ].join('\n\n'),
      }),
    })
  })

  it('returns provider failure status without treating it as a sent email', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))

    await expect(sendReminderEmail(reminder, 'resend-secret', 'ATM <noreply@example.test>'))
      .resolves.toEqual({ ok: false, status: 429 })
  })
})
