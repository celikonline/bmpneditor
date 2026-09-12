import { describe, expect, it, vi } from 'vitest'
import { workflowApi } from './workflowApi'
import type { StudioNode } from './workflowStore'

const task: StudioNode = { id: 'task', type: 'studio', position: { x: 0, y: 0 }, data: { label: 'demo', ref: 'demo_ref', kind: 'SIMPLE' } }

describe('workflow API idempotency', () => {
  it('returns the existing execution when requested', async () => {
    const key = `return-${Date.now()}`
    const first = await workflowApi.startExecution({ workflowName: 'demo', version: 1, idempotencyKey: key, strategy: 'FAIL', tasks: [task], executionInput: { jobId: 'abc' }, onEvent: () => undefined })
    expect(first.input).toEqual({ jobId: 'abc' })
    const existing = await workflowApi.startExecution({ workflowName: 'demo', version: 1, idempotencyKey: key, strategy: 'RETURN_EXISTING', tasks: [task], onEvent: () => undefined })
    expect(first.executionId).toMatch(/^exec_/)
    expect(existing.executionId).toBe(first.executionId)
  })

  it('rejects duplicate starts with FAIL strategy', async () => {
    const key = `fail-${Date.now()}`
    await workflowApi.startExecution({ workflowName: 'demo', version: 1, idempotencyKey: key, strategy: 'FAIL', tasks: [task], onEvent: () => undefined })
    await expect(workflowApi.startExecution({ workflowName: 'demo', version: 1, idempotencyKey: key, strategy: 'FAIL', tasks: [task], onEvent: () => undefined })).rejects.toThrow('idempotency key')
  })

  it('blocks saving a graph with validation errors', async () => {
    const broken: StudioNode = { ...task, id: 'broken', data: { ...task.data, ref: '' } }
    await expect(workflowApi.save({ name: 'demo', description: '', version: 1, schemaVersion: 2, enforceSchema: false, timeoutSeconds: 60, restartable: true, failureWorkflow: '', idempotencyStrategy: 'FAIL' }, [broken], [])).rejects.toThrow('Save blocked')
  })

  it('emits realtime lifecycle events and preserves execution metadata', async () => {
    vi.useFakeTimers()
    try {
      const realtime: string[] = []
      const key = `realtime-${Date.now()}`
      const record = await workflowApi.startExecution({ workflowName: 'demo', version: 2, idempotencyKey: key, strategy: 'FAIL', tasks: [task], executionInput: { jobId: 'xyz' }, correlationId: 'incident-7', priority: 5, executionName: 'health-check', metadata: { source: 'test' }, onEvent: () => undefined, onRealtimeEvent: (event) => realtime.push(event.type) })
      expect(record.correlationId).toBe('incident-7')
      expect(record.priority).toBe(5)
      expect(record.executionName).toBe('health-check')
      expect(realtime[0]).toBe('workflow.started')
      await vi.runAllTimersAsync()
      expect(record.status).toBe('COMPLETED')
      expect(realtime).toEqual(['workflow.started', 'task.scheduled', 'task.started', 'task.completed', 'workflow.completed'])
      expect(record.completedAt).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns polling worker details for a selected queue', async () => {
    const workers = await workflowApi.listQueueWorkers('http_request')
    expect(workers).toHaveLength(2)
    expect(workers[0]).toMatchObject({ workerId: 'worker-http-01', domain: 'prod', status: 'ACTIVE' })
    await expect(workflowApi.listQueueWorkers('unknown_queue')).resolves.toEqual([])
  })
})
