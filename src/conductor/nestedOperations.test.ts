import { describe, expect, it } from 'vitest'
import type { StudioNode, WorkflowTaskDraft } from '../workflowStore'
import { appendNestedTask, removeNestedTask } from './nestedOperations'

const child: WorkflowTaskDraft = { name: 'check_status', taskReferenceName: 'check_status_ref', type: 'HTTP', inputParameters: {}, optional: false }
const node = (kind: StudioNode['data']['kind'], config: StudioNode['data']['config']): StudioNode => ({ id: kind, type: kind === 'DO_WHILE' ? 'loop' : kind === 'SWITCH' ? 'switch' : 'studio', position: { x: 0, y: 0 }, data: { label: kind, ref: `${kind.toLowerCase()}_ref`, kind, config } })

describe('nested task operations', () => {
  it('appends and removes a task in a Do While loop', () => {
    const loop = appendNestedTask(node('DO_WHILE', { loopOver: [] }), child, '')
    expect(loop.data.config?.loopOver?.map((task) => task.taskReferenceName)).toEqual(['check_status_ref'])
    const removed = removeNestedTask(loop, { ref: 'check_status_ref' })
    expect(removed.data.config?.loopOver).toEqual([])
  })

  it('keeps Switch branches isolated', () => {
    const route = appendNestedTask(node('SWITCH', { cases: ['failed', 'completed'], decisionCases: { failed: [], completed: [] } }), child, 'completed')
    expect(route.data.config?.decisionCases?.failed).toEqual([])
    expect(route.data.config?.decisionCases?.completed?.[0].taskReferenceName).toBe('check_status_ref')
  })

  it('serializes Fork/Join branches for Conductor output', () => {
    const fork = appendNestedTask(node('FORK_JOIN', { forkBranches: [[]] }), child, 'fork:0')
    expect(fork.data.config?.forkBranches?.[0]?.[0].taskReferenceName).toBe('check_status_ref')
    expect(fork.data.config?.forkTasks).toContain('check_status_ref')
  })
})
