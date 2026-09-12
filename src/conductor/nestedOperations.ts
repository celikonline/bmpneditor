import type { StudioNode, WorkflowTaskDraft } from '../workflowStore'

export type NestedTaskTarget = { ref: string; branch?: string; index?: number }

function syncForkJson(branches: WorkflowTaskDraft[][]) {
  return JSON.stringify(branches.map((branch) => branch.map((task) => ({
    name: task.name,
    taskReferenceName: task.taskReferenceName,
    type: task.type,
    inputParameters: task.inputParameters,
    optional: task.optional,
    ...(task.config ? { config: task.config } : {}),
  }))))
}

/** Adds a typed task to an operator container without mutating the source node. */
export function appendNestedTask(node: StudioNode, task: WorkflowTaskDraft, target: string): StudioNode {
  const config = node.data.config ?? {}
  if (node.data.kind === 'DO_WHILE') {
    return { ...node, data: { ...node.data, config: { ...config, loopOver: [...(config.loopOver ?? []), task] } } }
  }
  if (node.data.kind === 'SWITCH') {
    const decisionCases = { ...(config.decisionCases ?? {}) }
    decisionCases[target] = [...(decisionCases[target] ?? []), task]
    return { ...node, data: { ...node.data, config: { ...config, decisionCases, defaultCase: target === 'defaultCase' ? decisionCases[target] : config.defaultCase } } }
  }
  if (node.data.kind === 'FORK_JOIN' && target.startsWith('fork:')) {
    const index = Number(target.slice('fork:'.length))
    const forkBranches = (config.forkBranches ?? [[]]).map((branch) => [...branch])
    while (forkBranches.length <= index) forkBranches.push([])
    forkBranches[index] = [...forkBranches[index], task]
    return { ...node, data: { ...node.data, config: { ...config, forkBranches, forkTasks: syncForkJson(forkBranches) } } }
  }
  return node
}

/** Removes a nested task from an operator container without mutating the source node. */
export function removeNestedTask(node: StudioNode, target: NestedTaskTarget): StudioNode {
  const config = node.data.config ?? {}
  if (node.data.kind === 'DO_WHILE') {
    return { ...node, data: { ...node.data, config: { ...config, loopOver: (config.loopOver ?? []).filter((task) => task.taskReferenceName !== target.ref) } } }
  }
  if (node.data.kind === 'SWITCH' && target.branch) {
    const decisionCases = { ...(config.decisionCases ?? {}), [target.branch]: (config.decisionCases?.[target.branch] ?? []).filter((task) => task.taskReferenceName !== target.ref) }
    return { ...node, data: { ...node.data, config: { ...config, decisionCases, defaultCase: target.branch === 'defaultCase' ? decisionCases.defaultCase : config.defaultCase } } }
  }
  if (node.data.kind === 'FORK_JOIN' && target.index != null) {
    const forkBranches = (config.forkBranches ?? [[]]).map((branch, index) => index === target.index ? branch.filter((task) => task.taskReferenceName !== target.ref) : [...branch])
    return { ...node, data: { ...node.data, config: { ...config, forkBranches, forkTasks: syncForkJson(forkBranches) } } }
  }
  return node
}
