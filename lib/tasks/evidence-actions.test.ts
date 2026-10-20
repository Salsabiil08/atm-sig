// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, createClient, createAdminClient, revalidatePath } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ getSessionUser }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient,
  AdminConfigurationError: class AdminConfigurationError extends Error {},
}))
vi.mock('next/cache', () => ({ revalidatePath }))

import {
  addEvidenceLink,
  getTaskEvidenceDownloadUrl,
  uploadTaskEvidence,
} from './actions'

const requirementId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const taskId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const evidenceId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function createFile(content: string, name: string, type: string) {
  const file = new File([content], name, { type })
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode(content).buffer,
    })
  }
  return file
}

describe('Evidence actions (FR-023, FR-024, NFR-005)', () => {
  let requirementQuery: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
  }
  let evidenceQuery: {
    insert: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
  }
  let storageBucket: {
    upload: ReturnType<typeof vi.fn>
  }
  let adminBucket: {
    remove: ReturnType<typeof vi.fn>
    createSignedUrl: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUser.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'pic@example.test',
      name: 'PIC',
      role: 'Staff/PIC',
      roleLevel: 2,
      orgUnitId: 4,
      supervisorId: null,
    })

    requirementQuery = {
      select: vi.fn(() => requirementQuery),
      eq: vi.fn(() => requirementQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: requirementId, task_id: taskId },
        error: null,
      }),
    }
    evidenceQuery = {
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => evidenceQuery),
      eq: vi.fn(() => evidenceQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { file_or_link: `${taskId}/${requirementId}/${evidenceId}.pdf` },
        error: null,
      }),
    }
    storageBucket = {
      upload: vi.fn().mockResolvedValue({ error: null }),
    }
    adminBucket = {
      remove: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://storage.example.test/signed-file' },
        error: null,
      }),
    }

    createClient.mockResolvedValue({
      from: vi.fn((table: string) =>
        table === 'evidence_requirements' ? requirementQuery : evidenceQuery,
      ),
      storage: { from: vi.fn(() => storageBucket) },
    })
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => adminBucket) } })
  })

  it('stores a validated HTTPS link against its evidence requirement', async () => {
    const result = await addEvidenceLink({
      requirementId,
      link: 'https://files.example.test/report.pdf',
    })

    expect(result).toEqual({ data: { success: true } })
    expect(evidenceQuery.insert).toHaveBeenCalledWith({
      requirement_id: requirementId,
      uploader_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      file_or_link: 'https://files.example.test/report.pdf',
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/tasks/${taskId}`)
  })

  it('rejects non-HTTPS links before using Supabase', async () => {
    const result = await addEvidenceLink({
      requirementId,
      link: 'http://files.example.test/report.pdf',
    })

    expect(result).toEqual({ error: 'Tautan evidence harus menggunakan HTTPS.' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('uploads an allowed file to private storage and stores its path', async () => {
    const file = createFile('%PDF-1.7 evidence', 'report.pdf', 'application/pdf')
    const result = await uploadTaskEvidence({ requirementId, file })

    expect(result).toEqual({ data: { success: true } })
    expect(storageBucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${taskId}/${requirementId}/[\\da-f-]+\\.pdf$`, 'i')),
      file,
      { contentType: 'application/pdf', upsert: false },
    )
    expect(evidenceQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      requirement_id: requirementId,
      file_or_link: expect.stringMatching(new RegExp(`^${taskId}/${requirementId}/`)),
    }))
  })

  it('rejects unsupported file types before upload', async () => {
    const file = createFile('<script>', 'unsafe.html', 'text/html')
    const result = await uploadTaskEvidence({ requirementId, file })

    expect(result).toEqual({
      error: 'File tidak valid. Gunakan PDF, JPG, PNG, atau CSV hingga 20 MB.',
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects file content that does not match its declared MIME type', async () => {
    const file = createFile('<script>alert(1)</script>', 'report.pdf', 'application/pdf')
    const result = await uploadTaskEvidence({ requirementId, file })

    expect(result).toEqual({
      error: 'Isi file tidak sesuai dengan jenis evidence yang dipilih.',
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects empty evidence links before using Supabase', async () => {
    const result = await addEvidenceLink({ requirementId, link: '  ' })

    expect(result).toEqual({ error: 'Tautan evidence tidak valid.' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('removes the uploaded file when its evidence row cannot be saved', async () => {
    evidenceQuery.insert.mockResolvedValue({ error: new Error('insert failed') })
    const file = createFile('%PDF-1.7 evidence', 'report.pdf', 'application/pdf')

    const result = await uploadTaskEvidence({ requirementId, file })

    expect(result).toEqual({
      error: 'Gagal menyimpan catatan evidence; file unggahan telah dibatalkan.',
    })
    expect(adminBucket.remove).toHaveBeenCalledOnce()
  })

  it('returns a short-lived signed URL for an authorized stored evidence row', async () => {
    const result = await getTaskEvidenceDownloadUrl(evidenceId)

    expect(result).toEqual({
      data: { url: 'https://storage.example.test/signed-file' },
    })
    expect(adminBucket.createSignedUrl).toHaveBeenCalledWith(
      `${taskId}/${requirementId}/${evidenceId}.pdf`,
      60,
      { download: true },
    )
  })
})
