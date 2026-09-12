import { ArrowDownToLine, Bot, Code2, FileJson, FileSearch, FileStack, GitBranch, Globe2, Hourglass, Image, Layers3, Merge, Paperclip, Plug, Rocket, Search, Settings2, Sparkles, UsersRound, Variable, Workflow, X, Zap } from 'lucide-react'
import type { ComponentType } from 'react'
import type { TaskKind } from './workflowStore'

export type TaskCatalogItem = {
  name: string
  desc: string
  group: string
  kind: TaskKind
  icon: ComponentType<{ size?: number }>
  action?: 'add' | 'open-integrations'
}

/** Mock implementation of the server-driven task catalog contract. */
const coreTaskCatalog: TaskCatalogItem[] = [
  { name: 'Worker Task (Simple)', desc: 'Runs a Worker task.', group: 'Worker Tasks', kind: 'SIMPLE', icon: Zap },
  { name: 'Event Task', desc: 'Publish an event to a messaging system (Kafka, AMQP, SQS, NATS, MQ).', group: 'System', kind: 'EVENT', icon: Zap },
  { name: 'HTTP Task', desc: 'Call an API / Microservice.', group: 'System', kind: 'HTTP', icon: Globe2 },
  { name: 'HTTP Poll Task', desc: 'Poll a remote endpoint periodically until a condition is met. Useful for long running jobs.', group: 'System', kind: 'HTTP_POLL', icon: ArrowDownToLine },
  { name: 'gRPC Task', desc: 'Call a gRPC service method.', group: 'System', kind: 'GRPC', icon: Globe2 },
  { name: 'Inline Task', desc: 'Run lightweight javascript code. Useful for data transformation.', group: 'System', kind: 'INLINE', icon: Code2 },
  { name: 'JSON JQ Transform', desc: 'Use the power of JQ to transform JSON.', group: 'System', kind: 'JSON_JQ_TRANSFORM', icon: FileJson },
  { name: 'Business Rule Task', desc: 'Evaluate business rules using Drools.', group: 'System', kind: 'BUSINESS_RULE', icon: Layers3 },
  { name: 'SQL Query', desc: 'Run SQL query against a database.', group: 'Connected Apps', kind: 'SQL', icon: FileJson },
  { name: 'Human Task', desc: 'Task that requires human interaction.', group: 'System', kind: 'HUMAN', icon: UsersRound },
  { name: 'Switch', desc: 'Route execution using matching cases.', group: 'System', kind: 'SWITCH', icon: GitBranch },
  { name: 'Do While', desc: 'Repeat a group of tasks while a condition is true.', group: 'System', kind: 'DO_WHILE', icon: ArrowDownToLine },
  { name: 'Fork/Join', desc: 'Run multiple task branches in parallel.', group: 'System', kind: 'FORK_JOIN', icon: Merge },
  { name: 'Dynamic Fork', desc: 'Create parallel branches dynamically at runtime.', group: 'System', kind: 'FORK_JOIN_DYNAMIC', icon: Merge },
  { name: 'Join', desc: 'Wait for one or more forked tasks to complete.', group: 'System', kind: 'JOIN', icon: Merge },
  { name: 'Dynamic', desc: 'Choose the task to execute from an input parameter.', group: 'System', kind: 'DYNAMIC', icon: GitBranch },
  { name: 'Sub Workflow', desc: 'Start another workflow as a child task.', group: 'System', kind: 'SUB_WORKFLOW', icon: Workflow },
  { name: 'Start Workflow', desc: 'Start another workflow execution.', group: 'System', kind: 'START_WORKFLOW', icon: Rocket },
  { name: 'Terminate Workflow', desc: 'Terminate the current workflow execution.', group: 'System', kind: 'TERMINATE_WORKFLOW', icon: X },
  { name: 'Terminate', desc: 'Terminate this task and workflow path.', group: 'System', kind: 'TERMINATE', icon: X },
  { name: 'Wait', desc: 'Pause workflow execution for a duration.', group: 'System', kind: 'WAIT', icon: Hourglass },
  { name: 'Yield', desc: 'Yield the workflow for asynchronous continuation.', group: 'System', kind: 'YIELD', icon: Hourglass },
  { name: 'Set Variable', desc: 'Set a workflow variable for later tasks.', group: 'System', kind: 'SET_VARIABLE', icon: Variable },
  { name: 'Get Workflow', desc: 'Retrieve details from another workflow execution.', group: 'System', kind: 'GET_WORKFLOW', icon: Workflow },
  { name: 'Exclusive Join', desc: 'Join a workflow after an exclusive route.', group: 'System', kind: 'EXCLUSIVE_JOIN', icon: Merge },
  { name: 'AI Chat Completion', desc: 'Generate a response with an AI model.', group: 'AI', kind: 'AI_CHAT_COMPLETION', icon: Bot },
  { name: 'AI Generate Image', desc: 'Generate an image from a prompt.', group: 'AI', kind: 'AI_GENERATE_IMAGE', icon: Sparkles },
]

/** Remaining OSS/AI task types exposed by the official ui-next catalog. */
const officialAdditionalCatalog: TaskCatalogItem[] = [
  ['Lambda Task', 'Invoke a Lambda function.', 'System', 'LAMBDA', Zap],
  ['SendGrid Task', 'Send email through SendGrid.', 'Connected Apps', 'SENDGRID', Zap],
  ['User Defined Task', 'Run a user-defined task type.', 'System', 'USER_DEFINED', Settings2],
  ['Terminal', 'End a workflow path.', 'System', 'TERMINAL', X],
  ['Jump', 'Jump to another workflow task.', 'System', 'JUMP', GitBranch],
  ['AI Task', 'Run an AI task extension.', 'AI', 'IA_TASK', Bot],
  ['Decision', 'Route using a decision expression.', 'System', 'DECISION', GitBranch],
  ['Kafka Publish', 'Publish a message to Kafka.', 'System', 'KAFKA_PUBLISH', Zap],
  ['Wait for Event', 'Wait for an event before continuing.', 'System', 'WAIT_FOR_EVENT', Hourglass],
  ['Task Summary', 'Summarize the state of a task.', 'System', 'TASK_SUMMARY', FileStack],
  ['Wait for Webhook', 'Wait for an HTTP webhook callback.', 'System', 'WAIT_FOR_WEBHOOK', Hourglass],
  ['JDBC Task', 'Run a JDBC database operation.', 'Connected Apps', 'JDBC', FileJson],
  ['Switch Join', 'Join paths created by a switch.', 'System', 'SWITCH_JOIN', Merge],
  ['LLM Text Complete', 'Complete text with a language model.', 'AI', 'LLM_TEXT_COMPLETE', Bot],
  ['LLM Chat Complete', 'Generate a chat completion.', 'AI', 'LLM_CHAT_COMPLETE', Bot],
  ['LLM Generate Embeddings', 'Generate vector embeddings.', 'AI', 'LLM_GENERATE_EMBEDDINGS', Sparkles],
  ['LLM Get Embeddings', 'Read embeddings for text.', 'AI', 'LLM_GET_EMBEDDINGS', Search],
  ['LLM Store Embeddings', 'Store embeddings in an index.', 'AI', 'LLM_STORE_EMBEDDINGS', FileStack],
  ['LLM Search Index', 'Search a vector index.', 'AI', 'LLM_SEARCH_INDEX', Search],
  ['LLM Search Embeddings', 'Search by vector similarity.', 'AI', 'LLM_SEARCH_EMBEDDINGS', Search],
  ['LLM Index Document', 'Index a document for retrieval.', 'AI', 'LLM_INDEX_DOCUMENT', FileStack],
  ['LLM Index Text', 'Index text for retrieval.', 'AI', 'LLM_INDEX_TEXT', FileStack],
  ['Get Document', 'Retrieve a document.', 'AI', 'GET_DOCUMENT', FileSearch],
  ['Update Secret', 'Update a secret value.', 'System', 'UPDATE_SECRET', Settings2],
  ['Query Processor', 'Query and transform data sources.', 'System', 'QUERY_PROCESSOR', Search],
  ['OpsGenie', 'Send an OpsGenie alert.', 'Connected Apps', 'OPS_GENIE', Zap],
  ['Get Signed JWT', 'Create a signed JWT.', 'System', 'GET_SIGNED_JWT', FileJson],
  ['Update Task', 'Update a task at runtime.', 'System', 'UPDATE_TASK', Settings2],
  ['Integration', 'Invoke a connected integration.', 'Connected Apps', 'INTEGRATION', Plug],
  ['Remote MCP', 'Invoke a remote MCP integration.', 'Connected Apps', 'MCP_REMOTE', Plug],
  ['Chunk Text', 'Split text into chunks.', 'AI', 'CHUNK_TEXT', FileStack],
  ['List Files', 'List files from a document source.', 'AI', 'LIST_FILES', FileStack],
  ['Parse Document', 'Parse and extract document content.', 'AI', 'PARSE_DOCUMENT', FileSearch],
  ['Agent', 'Invoke an agent.', 'AI', 'AGENT', Paperclip],
  ['Get Agent Card', 'Retrieve an agent card.', 'AI', 'GET_AGENT_CARD', Paperclip],
  ['Cancel Agent', 'Cancel an agent run.', 'AI', 'CANCEL_AGENT', X],
  ['List MCP Tools', 'List available MCP tools.', 'AI', 'LIST_MCP_TOOLS', Paperclip],
  ['Call MCP Tool', 'Call an MCP tool.', 'AI', 'CALL_MCP_TOOL', Paperclip],
  ['Generate Image', 'Generate an image.', 'AI', 'GENERATE_IMAGE', Image],
  ['Generate Audio', 'Generate audio content.', 'AI', 'GENERATE_AUDIO', Sparkles],
  ['Generate Video', 'Generate video content.', 'AI', 'GENERATE_VIDEO', Sparkles],
  ['Generate PDF', 'Generate a PDF document.', 'AI', 'GENERATE_PDF', FileStack],
].map(([name, desc, group, kind, icon]) => ({ name, desc, group, kind, icon })) as TaskCatalogItem[]

export const taskCatalog: TaskCatalogItem[] = [...coreTaskCatalog, ...officialAdditionalCatalog]

/** Items shown in the node + popup, matching the compact Orkes quick-add palette. */
export const quickAddCatalog: TaskCatalogItem[] = [
  { name: 'Worker Task (Simple)', desc: 'Runs a Worker task.', group: 'Quick Add', kind: 'SIMPLE', icon: Zap },
  { name: 'HTTP Task', desc: 'Call an API / Microservice.', group: 'Quick Add', kind: 'HTTP', icon: Globe2 },
  { name: 'HTTP Poll Task', desc: 'Poll a remote endpoint.', group: 'Quick Add', kind: 'HTTP_POLL', icon: ArrowDownToLine },
  { name: 'gRPC Task', desc: 'Call a gRPC service method.', group: 'Quick Add', kind: 'GRPC', icon: Globe2 },
  { name: 'Publish Event', desc: 'Publish an event.', group: 'Quick Add', kind: 'EVENT', icon: Zap },
  { name: 'Switch', desc: 'Route by an expression.', group: 'Quick Add', kind: 'SWITCH', icon: GitBranch },
  { name: 'Fork/Join', desc: 'Run multiple task branches in parallel.', group: 'Quick Add', kind: 'FORK_JOIN', icon: Merge },
  { name: 'Do While', desc: 'Repeat while a condition is true.', group: 'Quick Add', kind: 'DO_WHILE', icon: ArrowDownToLine },
  { name: 'Set Variable', desc: 'Set a workflow variable.', group: 'Quick Add', kind: 'SET_VARIABLE', icon: Variable },
  { name: 'Wait', desc: 'Pause execution.', group: 'Quick Add', kind: 'WAIT', icon: Hourglass },
  { name: 'Sub Workflow', desc: 'Start a child workflow.', group: 'Quick Add', kind: 'SUB_WORKFLOW', icon: Workflow },
  { name: 'Start Workflow', desc: 'Start another workflow.', group: 'Quick Add', kind: 'START_WORKFLOW', icon: Rocket },
  { name: 'Dynamic Fork', desc: 'Create parallel branches dynamically.', group: 'Quick Add', kind: 'FORK_JOIN_DYNAMIC', icon: Merge },
  { name: 'Join', desc: 'Wait for forked tasks.', group: 'Quick Add', kind: 'JOIN', icon: Merge },
  { name: 'Dynamic', desc: 'Choose a task dynamically.', group: 'Quick Add', kind: 'DYNAMIC', icon: GitBranch },
  { name: 'Yield', desc: 'Yield for asynchronous continuation.', group: 'Quick Add', kind: 'YIELD', icon: Hourglass },
  { name: 'Get Workflow', desc: 'Retrieve a workflow execution.', group: 'Quick Add', kind: 'GET_WORKFLOW', icon: Workflow },
  { name: 'Exclusive Join', desc: 'Join an exclusive route.', group: 'Quick Add', kind: 'EXCLUSIVE_JOIN', icon: Merge },
  { name: 'Terminate Workflow', desc: 'Terminate the workflow.', group: 'Quick Add', kind: 'TERMINATE_WORKFLOW', icon: X },
  { name: 'Terminate', desc: 'Terminate the workflow.', group: 'Quick Add', kind: 'TERMINATE', icon: X },
  { name: 'Javascript', desc: 'Run JavaScript code.', group: 'Quick Add', kind: 'INLINE', icon: Code2 },
  { name: 'Connected Apps', desc: 'Use a connected application.', group: 'Quick Add', kind: 'SIMPLE', icon: Plug, action: 'open-integrations' },
  { name: 'Human Task', desc: 'Task requiring human interaction.', group: 'Quick Add', kind: 'HUMAN', icon: UsersRound },
  { name: 'Chat Completion', desc: 'Generate a chat response.', group: 'Agentic Orchestration', kind: 'AI_CHAT_COMPLETION', icon: Bot },
  { name: 'Generate Embedding', desc: 'Generate an embedding.', group: 'Agentic Orchestration', kind: 'AI_CHAT_COMPLETION', icon: Code2 },
  { name: 'Search Embedding', desc: 'Search an embedding index.', group: 'Agentic Orchestration', kind: 'AI_CHAT_COMPLETION', icon: Search },
  { name: 'Index Document', desc: 'Index a document.', group: 'Agentic Orchestration', kind: 'AI_CHAT_COMPLETION', icon: FileStack },
  { name: 'Search Document', desc: 'Search indexed documents.', group: 'Agentic Orchestration', kind: 'AI_CHAT_COMPLETION', icon: FileSearch },
  { name: 'Agent', desc: 'Invoke an agent.', group: 'Agentic Orchestration', kind: 'AI_CHAT_COMPLETION', icon: Paperclip },
  { name: 'Get Agent', desc: 'Retrieve an agent.', group: 'Agentic Orchestration', kind: 'AI_CHAT_COMPLETION', icon: Paperclip },
  { name: 'Cancel Agent', desc: 'Cancel an agent run.', group: 'Agentic Orchestration', kind: 'TERMINATE', icon: X },
  { name: 'List MCP Tools', desc: 'List available MCP tools.', group: 'Agentic Orchestration', kind: 'AI_CHAT_COMPLETION', icon: Paperclip },
  { name: 'Call MCP Tool', desc: 'Call an MCP tool.', group: 'Agentic Orchestration', kind: 'AI_CHAT_COMPLETION', icon: Paperclip },
  { name: 'Generate Image', desc: 'Generate an image.', group: 'Agentic Orchestration', kind: 'AI_GENERATE_IMAGE', icon: Image },
]
