import { describe, expect, it } from 'vitest'
import { editorReducer, initialEditorState } from './editorState'

describe('editor state reducer', () => {
  it('keeps panel navigation and operation context in one state', () => {
    const selected = editorReducer(initialEditorState, { type: 'SET_SELECTED', value: 'route-status' })
    const opened = editorReducer(selected, { type: 'SET_OPERATION_CONTEXT', value: { nodeId: 'route-status', port: 'branch', branchName: 'completed' } })
    const panel = editorReducer(opened, { type: 'SET_TAB', value: 'Task' })
    expect(panel).toMatchObject({ selectedId: 'route-status', operationContext: { nodeId: 'route-status', port: 'branch', branchName: 'completed' }, activeTab: 'Task', drawerOpen: true })
  })

  it('supports closing menus without losing the selected node', () => {
    const state = editorReducer(initialEditorState, { type: 'SET_SELECTED', value: 'poll-loop' })
    const next = editorReducer(state, { type: 'SET_QUICK_ADD', value: true })
    const closed = editorReducer(next, { type: 'SET_QUICK_ADD', value: false })
    expect(closed.selectedId).toBe('poll-loop')
    expect(closed.quickAddOpen).toBe(false)
  })
})
