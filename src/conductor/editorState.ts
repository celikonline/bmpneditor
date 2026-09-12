import { useReducer, type Dispatch, type SetStateAction } from 'react'

export type EditorContextMenu = { nodeId: string; x: number; y: number }
export type EditorOperationContext = { nodeId: string; port: 'bottom' | 'branch'; branchName?: string }

export type EditorState = {
  activeTab: string
  selectedId: string | null
  pendingBranchName: string | null
  drawerOpen: boolean
  quickAddOpen: boolean
  contextMenu: EditorContextMenu | null
  operationContext: EditorOperationContext | null
}

type EditorEvent =
  | { type: 'SET_TAB'; value: string }
  | { type: 'SET_SELECTED'; value: string | null }
  | { type: 'SET_BRANCH'; value: string | null }
  | { type: 'SET_DRAWER'; value: boolean }
  | { type: 'SET_QUICK_ADD'; value: boolean }
  | { type: 'SET_CONTEXT_MENU'; value: EditorContextMenu | null }
  | { type: 'SET_OPERATION_CONTEXT'; value: EditorOperationContext | null }

export const initialEditorState: EditorState = {
  activeTab: 'Workflow',
  selectedId: null,
  pendingBranchName: null,
  drawerOpen: true,
  quickAddOpen: false,
  contextMenu: null,
  operationContext: null,
}

export function editorReducer(state: EditorState, event: EditorEvent): EditorState {
  switch (event.type) {
    case 'SET_TAB': return { ...state, activeTab: event.value }
    case 'SET_SELECTED': return { ...state, selectedId: event.value }
    case 'SET_BRANCH': return { ...state, pendingBranchName: event.value }
    case 'SET_DRAWER': return { ...state, drawerOpen: event.value }
    case 'SET_QUICK_ADD': return { ...state, quickAddOpen: event.value }
    case 'SET_CONTEXT_MENU': return { ...state, contextMenu: event.value }
    case 'SET_OPERATION_CONTEXT': return { ...state, operationContext: event.value }
  }
}

function setter<T>(dispatch: Dispatch<EditorEvent>, type: EditorEvent['type'], read: () => T) {
  return (value: SetStateAction<T>) => dispatch({ type, value: typeof value === 'function' ? (value as (current: T) => T)(read()) : value } as EditorEvent)
}

/** Typed reducer bridge that keeps React setter ergonomics during the XState migration. */
export function useEditorState() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState)
  return {
    ...state,
    setActiveTab: setter(dispatch, 'SET_TAB', () => state.activeTab),
    setSelectedId: setter(dispatch, 'SET_SELECTED', () => state.selectedId),
    setPendingBranchName: setter(dispatch, 'SET_BRANCH', () => state.pendingBranchName),
    setDrawerOpen: setter(dispatch, 'SET_DRAWER', () => state.drawerOpen),
    setQuickAddOpen: setter(dispatch, 'SET_QUICK_ADD', () => state.quickAddOpen),
    setContextMenu: setter(dispatch, 'SET_CONTEXT_MENU', () => state.contextMenu),
    setOperationContext: setter(dispatch, 'SET_OPERATION_CONTEXT', () => state.operationContext),
  }
}
