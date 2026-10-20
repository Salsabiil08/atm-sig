// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DashboardPerformance } from '@/lib/dashboard/queries'
import PerformanceOverview from './PerformanceOverview'

const performance: DashboardPerformance = {
  owners: [{
    id: 'user-1',
    name: 'Rina',
    activeTasks: 2,
    overdueTasks: 1,
    averageProgress: 40,
  }],
  orgUnits: [{
    id: 4,
    name: 'Section Accounting',
    activeTasks: 2,
    overdueTasks: 1,
    averageProgress: 40,
  }],
}

describe('PerformanceOverview (FR-072)', () => {
  it('shows progress, active workload and overdue task count', () => {
    render(<PerformanceOverview performance={performance} />)

    expect(screen.getByText('Rina')).toBeTruthy()
    expect(screen.getAllByText('40% · 2 aktif')).toHaveLength(2)
    expect(screen.getAllByText('1 task lewat tenggat')).toHaveLength(2)
    expect(screen.getByRole('progressbar', { name: 'Progress rata-rata Rina' })
      .getAttribute('aria-valuenow')).toBe('40')
  })

  it('shows empty states when there are no active tasks', () => {
    render(<PerformanceOverview performance={{ owners: [], orgUnits: [] }} />)

    expect(screen.getAllByText('Belum ada task aktif dalam cakupan Anda.')).toHaveLength(2)
  })
})
