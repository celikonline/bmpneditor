import { describe, expect, it } from 'vitest'
import { can, redactSecrets, safeAuditEvent } from './security'
import { extractExpressions, validateExpressions } from './expressions'

describe('security helpers', () => {
  it('enforces role permissions', () => {
    expect(can('viewer', 'workflow:read')).toBe(true)
    expect(can('viewer', 'workflow:execute')).toBe(false)
    expect(can('admin', 'workflow:publish')).toBe(true)
  })
  it('redacts secret-like keys recursively', () => {
    expect(redactSecrets({ token: 'abc', nested: { password: 'xyz', ok: true } })).toEqual({ token: '••••••••', nested: { password: '••••••••', ok: true } })
    expect(safeAuditEvent('run', 'operator', { authorization: 'Bearer secret' }).metadata).toEqual({ authorization: '••••••••' })
  })
})

describe('workflow expressions', () => {
  it('extracts workflow, task, secret and env references', () => {
    const refs = extractExpressions('${workflow.input.jobId} ${check_ref.output.status} ${secret.API_TOKEN} ${env.REGION}')
    expect(refs.map((ref) => ref.source)).toEqual(['workflow.input', 'task.output', 'secret', 'env'])
  })
  it('flags unknown task references', () => {
    expect(validateExpressions('${unknown_ref.output.value}', ['check_ref'])).toEqual(['Unknown task reference in ${unknown_ref.output.value}.'])
  })
  it('supports the Orkes workflow namespaces without false task errors', () => {
    const refs = extractExpressions('${workflow.output.result} ${workflow.variables.status} ${workflow.secrets.API_TOKEN} ${workflow.env.API_BASE_URL} ${task_ref.input.id}')
    expect(refs.map((ref) => ref.source)).toEqual(['workflow.output', 'workflow.variables', 'secret', 'env', 'task.input'])
    expect(validateExpressions('${workflow.output.result} ${workflow.variables.status} ${workflow.secrets.API_TOKEN} ${workflow.env.API_BASE_URL}', [])).toEqual([])
  })
})
