// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(() => cleanup())
import WorkspaceTabs, { APPROVAL_TABS, WORK_TABS } from './WorkspaceTabs'

describe('Grouped workspace tabs (audit R.03)', () => {
  it('shows PIC task views without privileged approval', () => {
    render(<WorkspaceTabs current="/tasks?mine=1" tabs={WORK_TABS} roleLevel={2} />)
    expect(screen.getByRole('link', { name: 'Tugas Saya' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('link', { name: 'Papan Tugas' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Tugas Tim' })).toBeNull()
  })

  it('shows team views only to Manager and above', () => {
    render(<WorkspaceTabs current="/tasks" tabs={WORK_TABS} roleLevel={3} />)
    expect(screen.getByRole('link', { name: 'Tugas Tim' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Papan Tugas' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Linimasa' })).toBeTruthy()
  })

  it('does not display deadline approvals for Manager', () => {
    render(<WorkspaceTabs current="/review-inbox" tabs={APPROVAL_TABS} roleLevel={3} />)
    expect(screen.getByRole('link', { name: 'Tinjauan Tugas' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Persetujuan Tenggat' })).toBeNull()
  })

  it('shows both approval tabs to Senior Manager', () => {
    render(<WorkspaceTabs current="/approvals" tabs={APPROVAL_TABS} roleLevel={4} />)
    expect(screen.getByRole('link', { name: 'Persetujuan Tenggat' }).getAttribute('aria-current')).toBe('page')
  })
})
