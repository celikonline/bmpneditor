import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ArrowDownToLine, Bot, GitBranch, Globe2, Hourglass, Plus, Radio, UsersRound, Workflow, X, Zap } from 'lucide-react'
import type { StudioNode } from '../workflowStore'

/**
 * Canvas node component port of ui-next's TaskCard/operator shapes.
 * React Flow remains the host renderer, while all operator-specific markup
 * lives behind the same node registry boundary as the official mapper.
 */
export function StartNode({ data }: NodeProps<StudioNode>) {
  return <div className="start-node"><Handle type="source" position={Position.Bottom} /><div className="start-circle">Start</div><AddConnector onAdd={data.onAddConnector} /></div>
}

export function EndNode() {
  return <div className="end-node"><Handle type="target" position={Position.Top} /><div className="end-circle">End</div></div>
}

export function StudioTaskNode({ data, selected }: NodeProps<StudioNode>) {
  const icon = data.kind === 'HTTP' || data.kind === 'HTTP_POLL' || data.kind === 'GRPC' ? <Globe2 size={12} /> : data.kind === 'WAIT' || data.kind === 'WAIT_FOR_WEBHOOK' ? <Hourglass size={12} /> : data.kind === 'EVENT' || data.kind === 'KAFKA_PUBLISH' ? <Radio size={12} /> : data.kind === 'HUMAN' ? <UsersRound size={12} /> : data.kind === 'SUB_WORKFLOW' || data.kind === 'START_WORKFLOW' ? <Workflow size={12} /> : data.kind === 'SWITCH' || data.kind === 'DYNAMIC' ? <GitBranch size={12} /> : data.kind === 'AGENT' || data.kind.startsWith('LLM_') ? <Bot size={12} /> : data.kind === 'TERMINATE' || data.kind === 'TERMINATE_WORKFLOW' || data.kind === 'TERMINAL' ? <X size={12} /> : <Zap size={12} />
  const isForkJoin = data.kind === 'FORK_JOIN'
  const forkBranches = data.config?.forkBranches ?? [[]]
  const isTerminal = data.kind === 'TERMINATE' || data.kind === 'TERMINATE_WORKFLOW' || data.kind === 'TERMINAL'
  return <div className={`task-node ${selected ? 'selected' : ''} ${isTerminal ? 'terminal' : ''} ${data.runtimeState ?? ''}`}><Handle type="target" position={Position.Top} /><RemoveNode onRemove={data.onRemove} /><div className="node-title"><span className="node-icon">{icon}</span><span>{data.label}</span><span className="kind-pill">{data.runtimeState === 'running' ? 'RUNNING' : data.kind}</span></div><div className="node-ref">{data.ref}</div>{data.detail && <div className="node-detail">{data.detail}</div>}{isForkJoin && <div className="fork-branches">{forkBranches.map((branch, index) => <div className="fork-branch" key={`fork-${index}`}><span>Branch {index + 1}</span>{branch.map((task) => <small key={task.taskReferenceName}>{task.name}<button className="nested-remove" aria-label={`Delete nested task ${task.name}`} onClick={(event) => { event.stopPropagation(); data.onRemoveNestedTask?.({ ref: task.taskReferenceName, index }) }}>×</button></small>)}<button aria-label={`Add task to fork branch ${index + 1}`} onClick={(event) => { event.stopPropagation(); data.onAddBranch?.(`fork:${index}`) }}>＋</button></div>)}<button className="add-fork-branch" aria-label="Add fork branch" onClick={(event) => { event.stopPropagation(); data.onAddBranch?.(`fork:${forkBranches.length}`) }}>＋ Add branch</button></div>}<Handle type="source" position={Position.Bottom} /><AddConnector onAdd={data.onAddConnector} /></div>
}

export function LoopNode({ data, selected }: NodeProps<StudioNode>) {
  const nestedTasks = data.config?.loopOver ?? []
  return <div className={`loop-node ${selected ? 'selected' : ''}`}><Handle type="target" position={Position.Top} /><RemoveNode onRemove={data.onRemove} /><div className="group-heading"><ArrowDownToLine size={13} /> {data.label}<span className="kind-pill">DO_WHILE</span></div>{nestedTasks.length ? nestedTasks.map((task) => <div className="group-slot" key={task.taskReferenceName}><span>{task.type === 'WAIT' ? '⌛' : task.type === 'HTTP' ? '◎' : '•'}</span> {task.name} <small>{task.type}</small><button className="nested-remove" aria-label={`Delete nested task ${task.name}`} onClick={(event) => { event.stopPropagation(); data.onRemoveNestedTask?.({ ref: task.taskReferenceName }) }}>×</button></div>) : <><div className="group-slot"><span>⌛</span> wait_between_polls <small>WAIT</small></div><div className="group-slot"><span>◎</span> check_status <small>HTTP</small></div></>}<button className="add-loop-task" aria-label="Add task inside Do While" onClick={(event) => { event.stopPropagation(); data.onAddNested?.() }}>＋ Add inside</button><Handle type="source" position={Position.Bottom} /><AddConnector onAdd={data.onAddConnector} /></div>
}

export function SwitchNode({ data, selected }: NodeProps<StudioNode>) {
  const branches = data.config?.cases?.length ? data.config.cases : ['defaultCase']
  const decisionCases = data.config?.decisionCases ?? {}
  return <div className={`switch-node ${selected ? 'selected' : ''}`}><Handle type="target" position={Position.Top} /><RemoveNode onRemove={data.onRemove} /><div className="switch-diamond"><GitBranch size={16} /><strong>{data.label}</strong><small>{data.ref}</small></div><div className="switch-branches">{branches.map((branch) => <div className="switch-branch" key={branch}><span className="switch-branch-name">{branch}</span>{(decisionCases[branch] ?? []).map((task) => <small key={task.taskReferenceName}>{task.name}<button className="nested-remove" aria-label={`Delete nested task ${task.name}`} onClick={(event) => { event.stopPropagation(); data.onRemoveNestedTask?.({ ref: task.taskReferenceName, branch }) }}>×</button></small>)}<button aria-label={`Add task to ${branch}`} title={`Add task to ${branch}`} onClick={(event) => { event.stopPropagation(); data.onAddBranch?.(branch) }}>＋</button></div>)}</div><Handle type="source" position={Position.Bottom} /><AddConnector onAdd={data.onAddConnector} /></div>
}

export function JoinNode({ data }: NodeProps<StudioNode>) {
  return <div className="join-node"><Handle type="target" position={Position.Top} /><RemoveNode onRemove={data.onRemove} /><span>// {data.label}</span><Handle type="source" position={Position.Bottom} /><AddConnector onAdd={data.onAddConnector} /></div>
}

function AddConnector({ onAdd }: { onAdd?: () => void }) {
  return <button className="node-add-connector" aria-label="Add task after this node" onClick={(event) => { event.stopPropagation(); onAdd?.() }}><Plus size={11} /></button>
}

function RemoveNode({ onRemove }: { onRemove?: () => void }) {
  return <button className="node-remove" aria-label="Delete node" onClick={(event) => { event.stopPropagation(); onRemove?.() }}>×</button>
}

export const nodeTypes = { start: StartNode, end: EndNode, studio: StudioTaskNode, loop: LoopNode, switch: SwitchNode, join: JoinNode }
