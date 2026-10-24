// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(() => cleanup())
import WorkspaceTabs, { APPROVAL_TABS, WORK_TABS } from './WorkspaceTabs'

describe('Grouped workspace tabs (audit R.03)', () => {
  it('shows PIC task views without privileged approval', () => {
    render(<WorkspaceTabs current="/tasks?mine=1" tabs={WORK_TABS} roleLevel={2} />)
    expect(screen.getByRole('link', { name: 'Tugas Saya' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Kanban' }).getAttribute('href')).toBe('/kanban')
  })

  it('does not display deadline approvals for Manager', () => {
    render(<WorkspaceTabs current="/review-inbox" tabs={APPROVAL_TABS} roleLevel={3} />)
    expect(screen.getByRole('link', { name: 'Review Task' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Approval Deadline' })).toBeNull()
  })

  it('shows both approval tabs to Senior Manager', () => {
    render(<WorkspaceTabs current="/approvals" tabs={APPROVAL_TABS} roleLevel={4} />)
    expect(screen.getByRole('link', { name: 'Approval Deadline' }).getAttribute('aria-current')).toBe('page')
  })
})
