import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, createClient, createAdminClient, revalidatePath, rpc } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({
  getSessionUser,
  requireRole: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { createTask, deleteTask, reviewTask, updateTask, updateTaskStartDate, updateTaskStatus } from './actions'

const taskId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const taskInput = {
  title: '  Monthly reconciliation  ',
  ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  reviewerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  orgUnitId: 4,
  parentTaskId: null,
  priority: 'tinggi' as const,
  startDate: '2026-10-01T00:00:00.000Z',
  dueDate: '2026-10-05T00:00:00.000Z',
}

let taskQuery: ReturnType<typeof createTaskQuery>
let auditQuery: { insert: ReturnType<typeof vi.fn> }
let evidenceQuery: ReturnType<typeof createEvidenceQuery>
let userQuery: ReturnType<typeof createUserQuery>
let roleQuery: ReturnType<typeof createRoleQuery>

function createTaskQuery() {
  const query = {
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  }
  return query
}

function createEvidenceQuery() {
  const query = {
    insert: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ error: null }).then(resolve, reject),
  }
  return query
}

function createUserQuery() {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({
        data: [
          {
            id: taskInput.ownerId,
            role_id: 2,
            supervisor_id: taskInput.reviewerId,
            status: 'aktif',
          },
          {
            id: taskInput.reviewerId,
            role_id: 3,
            supervisor_id: null,
            status: 'aktif',
          },
        ],
        error: null,
      }).then(resolve, reject),
  }
  return query
}

function createRoleQuery() {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({
        data: [{ id: 2, level: 2 }, { id: 3, level: 3 }],
        error: null,
      }).then(resolve, reject),
  }
  return query
}

describe('Task CRUD actions (FR-020, FR-021)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: taskId, error: null })
    getSessionUser.mockResolvedValue({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      email: 'manager@example.test',
      name: 'Manager',
      role: 'Manager',
      roleLevel: 3,
      orgUnitId: 4,
      supervisorId: null,
    })
    taskQuery = createTaskQuery()
    evidenceQuery = createEvidenceQuery()
    userQuery = createUserQuery()
    roleQuery = createRoleQuery()
    auditQuery = { insert: vi.fn().mockResolvedValue({ error: null }) }
    createClient.mockResolvedValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === 'users') return userQuery
        if (table === 'roles') return roleQuery
        if (table === 'evidence_requirements') return evidenceQuery
        return taskQuery
      }),
    })
    createAdminClient.mockReturnValue({ from: vi.fn(() => auditQuery) })
  })

  it('creates a task with normalized title and initial To do state', async () => {
    taskQuery.single.mockResolvedValue({ data: { id: taskId }, error: null })

    const result = await createTask(taskInput)

    expect(result).toEqual({ data: { id: taskId } })
    expect(taskQuery.insert).toHaveBeenCalledWith({
      owner_id: taskInput.ownerId,
      assigner_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      reviewer_id: taskInput.reviewerId,
      org_unit_id: taskInput.orgUnitId,
      parent_task_id: null,
      title: 'Monthly reconciliation',
      priority: 'tinggi',
      start_date: taskInput.startDate,
      due_date: taskInput.dueDate,
    })
  })

  it('updates a scoped Manager start date through the FR-111 action', async () => {
    taskQuery.maybeSingle.mockResolvedValue({ data: { id: taskId }, error: null })

    const result = await updateTaskStartDate({ taskId, startDate: '2026-10-02' })

    expect(result).toEqual({ data: { success: true } })
    expect(taskQuery.update).toHaveBeenCalledWith({ start_date: '2026-10-02' })
    expect(taskQuery.eq).toHaveBeenCalledWith('id', taskId)
    expect(revalidatePath).toHaveBeenCalledWith('/timeline')
  })

  it('rejects invalid start dates before writing to the database', async () => {
    const result = await updateTaskStartDate({ taskId, startDate: '2026-02-30' })
    expect(result).toEqual({ error: 'Tanggal mulai task tidak valid.' })
    expect(taskQuery.update).not.toHaveBeenCalled()
  })

  it('rejects invalid data before calling Supabase', async () => {
    const result = await createTask({ ...taskInput, dueDate: taskInput.startDate })

    expect(result).toEqual({ error: 'Tenggat harus setelah tanggal mulai.' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects a reviewer who is not the PIC direct supervisor before inserting', async () => {
    const result = await createTask({
      ...taskInput,
      reviewerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    })
    expect(result).toEqual({
      error: 'Reviewer task harus merupakan atasan aktif PIC.',
    })
    expect(taskQuery.insert).not.toHaveBeenCalled()
  })

  it('requires a rejection comment before calling the atomic review RPC', async () => {
    const result = await reviewTask({ taskId, decision: 'Revisi', comment: '  ' })

    expect(result).toEqual({ error: 'Komentar wajib diisi untuk menolak task.' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('calls the review RPC and audits an approved decision', async () => {
    const result = await reviewTask({
      taskId,
      decision: 'Done',
      comment: 'Sudah sesuai.',
    })

    expect(result).toEqual({ data: { success: true } })
    expect(rpc).toHaveBeenCalledWith('review_task', {
      p_task_id: taskId,
      p_decision: 'Done',
      p_comment: 'Sudah sesuai.',
    })
    expect(auditQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'review_task',
      old_value: 'Review',
      new_value: 'Done',
    }))
  })

  it('allows a scoped Manager to perform an ordinary status move on a non-owned task', async () => {
    taskQuery.maybeSingle
      .mockResolvedValueOnce({
        data: { id: taskId, status: 'To do', owner_id: taskInput.ownerId, reviewer_id: taskInput.reviewerId, org_unit_id: 4 },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: taskId }, error: null })

    const result = await updateTaskStatus({ taskId, status: 'In progress' })

    expect(result).toEqual({ data: { success: true } })
    expect(taskQuery.update).toHaveBeenCalledWith({ status: 'In progress' })
  })

  it('does not let a scoped Manager bypass the assigned reviewer decision', async () => {
    taskQuery.maybeSingle.mockResolvedValueOnce({
      data: { id: taskId, status: 'Review', owner_id: taskInput.ownerId, reviewer_id: taskInput.reviewerId, org_unit_id: 4 },
      error: null,
    })

    const result = await updateTaskStatus({ taskId, status: 'Done' })

    expect(result).toEqual({ error: 'Transisi status Review ke Done tidak diizinkan.' })
    expect(taskQuery.update).not.toHaveBeenCalled()
  })

  it('saves evidence requirements with the new task', async () => {
    taskQuery.single.mockResolvedValue({ data: { id: taskId }, error: null })

    const result = await createTask({
      ...taskInput,
      evidenceRequirements: [
        { description: '  Signed reconciliation  ', mandatory: true },
      ],
    })

    expect(result).toEqual({ data: { id: taskId } })
    expect(evidenceQuery.insert).toHaveBeenCalledWith([
      {
        task_id: taskId,
        description: 'Signed reconciliation',
        mandatory: true,
      },
    ])
  })

  it('updates task details and records the change', async () => {
    taskQuery.maybeSingle
      .mockResolvedValueOnce({
        data: { id: taskId, title: 'Old title', owner_id: taskInput.ownerId },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: taskId }, error: null })

    const result = await updateTask({ ...taskInput, taskId })

    expect(result).toEqual({ data: { success: true } })
    expect(taskQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Monthly reconciliation',
      owner_id: taskInput.ownerId,
      org_unit_id: taskInput.orgUnitId,
    }))
    expect(auditQuery.insert).toHaveBeenCalledOnce()
  })

  it('does not update an inaccessible or missing task', async () => {
    taskQuery.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await updateTask({ ...taskInput, taskId })

    expect(result).toEqual({ error: 'Task tidak ditemukan atau berada di luar cakupan Anda.' })
    expect(taskQuery.update).not.toHaveBeenCalled()
  })

  it('requires the reassignment action to change the task PIC', async () => {
    taskQuery.maybeSingle.mockResolvedValueOnce({
      data: { id: taskId, title: 'Old title', owner_id: taskInput.ownerId },
      error: null,
    })

    const result = await updateTask({
      ...taskInput,
      ownerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      taskId,
    })

    expect(result).toEqual({ error: 'Gunakan aksi pindah task untuk mengganti PIC.' })
    expect(taskQuery.update).not.toHaveBeenCalled()
  })

  it('deletes an accessible task and revalidates task listings', async () => {
    taskQuery.maybeSingle
      .mockResolvedValueOnce({ data: { id: taskId, title: 'Monthly reconciliation' }, error: null })
      .mockResolvedValueOnce({ data: { id: taskId }, error: null })

    const result = await deleteTask(taskId)

    expect(result).toEqual({ data: { success: true } })
    expect(taskQuery.delete).toHaveBeenCalledOnce()
    expect(revalidatePath).toHaveBeenCalledWith('/tasks')
    expect(auditQuery.insert).toHaveBeenCalledOnce()
  })

  it('rejects malformed task ids before querying Supabase', async () => {
    const result = await deleteTask('not-a-uuid')

    expect(result).toEqual({ error: 'ID task tidak valid.' })
    expect(createClient).not.toHaveBeenCalled()
  })
})
