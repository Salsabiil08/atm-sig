import { describe, expect, it } from 'vitest'
import {
  calculateReminderCheckpointState,
  calculateWeightedWorkProgress,
  type WeightedWorkItem,
} from './checkpoints'

const startDate = '2026-10-19T00:00:00.000Z'
const longDueDate = '2026-10-21T00:00:00.000Z'
const shortDueDate = '2026-10-19T12:00:00.000Z'

const workItems: WeightedWorkItem[] = [
  { id: 'root-1', parentId: null, weight: 60, isDone: false },
  { id: 'child-1', parentId: 'root-1', weight: 30, isDone: false },
  { id: 'child-2', parentId: 'root-1', weight: 30, isDone: false },
  { id: 'root-2', parentId: null, weight: 40, isDone: true },
]

describe('reminder checkpoint calculation (FR-050, BR-030..BR-032)', () => {
  it('calculates elapsed percentage against absolute timestamps for multi-day tasks', () => {
    const result = calculateReminderCheckpointState({
      startDate,
      dueDate: longDueDate,
      now: new Date('2026-10-20T00:00:00.000Z'),
      status: 'In progress',
      progressPct: 40,
    })

    expect(result).toMatchObject({
      elapsedPct: 50,
      workCompletedPct: 40,
      isShortTask: false,
      dueCheckpoints: [50],
    })
  })

  it.each([
    { checkpoint: 50, hour: 12, due: '2026-10-20T00:00:00.000Z' },
    { checkpoint: 80, hour: 19.2, due: '2026-10-20T00:00:00.000Z' },
    { checkpoint: 90, hour: 21.6, due: '2026-10-20T00:00:00.000Z' },
  ])('reaches the $checkpoint% elapsed boundary exactly', ({ checkpoint, hour, due }) => {
    const now = new Date(Date.parse(startDate) + hour * 60 * 60 * 1000)
    const result = calculateReminderCheckpointState({
      startDate,
      dueDate: due,
      now,
      status: 'In progress',
      progressPct: 0,
    })
    expect(result?.dueCheckpoints).toContain(checkpoint)
  })

  it('applies the PIC progress gate at 50% and permits 80/90% reminders while blocked or in review', () => {
    const blocked = calculateReminderCheckpointState({
      startDate,
      dueDate: longDueDate,
      now: new Date('2026-10-20T20:00:00.000Z'),
      status: 'Blocked',
      progressPct: 50,
    })
    const review = calculateReminderCheckpointState({
      startDate,
      dueDate: longDueDate,
      now: new Date('2026-10-20T20:00:00.000Z'),
      status: 'Review',
      progressPct: 50,
    })

    expect(blocked?.dueCheckpoints).toEqual([80, 90])
    expect(review?.dueCheckpoints).toEqual([80, 90])
  })

  it('uses weighted completed leaf WBS items for tasks shorter than 24 hours', () => {
    expect(calculateWeightedWorkProgress(workItems)).toBe(40)

    const result = calculateReminderCheckpointState({
      startDate,
      dueDate: shortDueDate,
      now: new Date('2026-10-19T10:48:00.000Z'),
      status: 'In progress',
      progressPct: 99,
      workItems,
    })

    expect(result).toMatchObject({
      elapsedPct: 90,
      workCompletedPct: 40,
      isShortTask: true,
      dueCheckpoints: [50, 80, 90],
    })
  })

  it('does not invent short-task progress when no weighted WBS work exists', () => {
    expect(calculateWeightedWorkProgress([])).toBeNull()
    expect(calculateReminderCheckpointState({
      startDate,
      dueDate: shortDueDate,
      now: new Date('2026-10-19T06:00:00.000Z'),
      status: 'In progress',
      progressPct: 0,
    })).toBeNull()
  })

  it('does not issue reminders before start, at/after deadline, for completed tasks, or invalid dates', () => {
    for (const now of [
      new Date('2026-10-18T23:59:59.999Z'),
      new Date(longDueDate),
      new Date('2026-10-22T00:00:00.000Z'),
    ]) {
      expect(calculateReminderCheckpointState({
        startDate,
        dueDate: longDueDate,
        now,
        status: 'In progress',
        progressPct: 0,
      })).toBeNull()
    }
    expect(calculateReminderCheckpointState({
      startDate,
      dueDate: longDueDate,
      now: new Date('2026-10-20T20:00:00.000Z'),
      status: 'Done',
      progressPct: 0,
    })?.dueCheckpoints).toEqual([])
    expect(calculateReminderCheckpointState({
      startDate,
      dueDate: startDate,
      now: new Date(startDate),
      status: 'In progress',
      progressPct: 0,
    })).toBeNull()
  })
})
