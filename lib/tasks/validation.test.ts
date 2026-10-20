import { describe, expect, it } from 'vitest'
import { validateEvidenceRequirements, validateTaskDetails } from './validation'

const validTask = {
  title: 'Reconcile monthly accounts',
  ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  reviewerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  orgUnitId: 4,
  parentTaskId: null,
  priority: 'tinggi',
  startDate: '2026-10-01T00:00:00.000Z',
  dueDate: '2026-10-05T00:00:00.000Z',
}

describe('validateTaskDetails (FR-020, FR-021)', () => {
  it('normalizes valid task fields and dates', () => {
    const result = validateTaskDetails({ ...validTask, title: '  Monthly reconciliation  ' })

    expect(result).toEqual({
      ok: true,
      data: {
        ...validTask,
        title: 'Monthly reconciliation',
        startDate: '2026-10-01T00:00:00.000Z',
        dueDate: '2026-10-05T00:00:00.000Z',
      },
    })
  })

  it('rejects a missing title, malformed identifiers, and invalid priority', () => {
    expect(validateTaskDetails({ ...validTask, title: '  ' })).toEqual({
      ok: false,
      error: 'Judul task wajib diisi.',
    })
    expect(validateTaskDetails({ ...validTask, ownerId: 'invalid' })).toEqual({
      ok: false,
      error: 'PIC task tidak valid.',
    })
    expect(validateTaskDetails({ ...validTask, priority: 'urgent' })).toEqual({
      ok: false,
      error: 'Prioritas task tidak valid.',
    })
  })

  it('rejects invalid dates and a due date that is not after the start date', () => {
    expect(validateTaskDetails({ ...validTask, startDate: 'not-a-date' })).toEqual({
      ok: false,
      error: 'Format tanggal task tidak valid.',
    })
    expect(validateTaskDetails({ ...validTask, dueDate: validTask.startDate })).toEqual({
      ok: false,
      error: 'Tenggat harus setelah tanggal mulai.',
    })
  })

  it('accepts an empty evidence list and validates configured requirements', () => {
    expect(validateEvidenceRequirements(undefined)).toEqual({ ok: true, data: [] })
    expect(validateEvidenceRequirements([
      { description: '  Signed reconciliation  ', mandatory: true },
      { description: 'Supporting notes', mandatory: false },
    ])).toEqual({
      ok: true,
      data: [
        { description: 'Signed reconciliation', mandatory: true },
        { description: 'Supporting notes', mandatory: false },
      ],
    })
    expect(validateEvidenceRequirements([{ description: ' ', mandatory: true }])).toEqual({
      ok: false,
      error: 'Deskripsi evidence wajib diisi.',
    })
  })
})
