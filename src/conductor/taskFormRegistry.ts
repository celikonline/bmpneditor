import type { TaskKind } from '../workflowStore'

export type TaskFormGroup = 'System' | 'Worker' | 'Connected Apps' | 'AI' | 'Agentic Orchestration' | 'Generic'

export type TaskFormDefinition = {
  group: TaskFormGroup
  label: string
  docs?: string
}

const docsRoot = 'https://orkes.io/content/docs/reference-docs'

const definitions: Partial<Record<TaskKind, TaskFormDefinition>> = {
  START: { group: 'System', label: 'Start' },
  USER_DEFINED: { group: 'System', label: 'User Defined Task' },
  LAMBDA: { group: 'System', label: 'Lambda Task' },
  TERMINAL: { group: 'System', label: 'Terminal' },
  SENDGRID: { group: 'Connected Apps', label: 'SendGrid Task' },
  IA_TASK: { group: 'AI', label: 'AI Task' },
  JUMP: { group: 'System', label: 'Jump' },
  SIMPLE: { group: 'Worker', label: 'Worker Task', docs: 'https://orkes.io/content/reference-docs/worker-task' },
  HTTP: { group: 'System', label: 'HTTP Task', docs: `${docsRoot}/system-tasks/http-task` },
  HTTP_POLL: { group: 'System', label: 'HTTP Poll Task', docs: `${docsRoot}/system-tasks/http-poll-task` },
  EVENT: { group: 'System', label: 'Event Task', docs: `${docsRoot}/system-tasks/event-task` },
  KAFKA_PUBLISH: { group: 'System', label: 'Kafka Publish Task', docs: `${docsRoot}/system-tasks/kafka-publish-task` },
  INLINE: { group: 'System', label: 'Inline Task', docs: `${docsRoot}/system-tasks/inline-task` },
  JSON_JQ_TRANSFORM: { group: 'System', label: 'JSON JQ Transform', docs: `${docsRoot}/system-tasks/json-jq-transform-task` },
  BUSINESS_RULE: { group: 'System', label: 'Business Rule Task', docs: `${docsRoot}/system-tasks/business-rule` },
  SQL: { group: 'Connected Apps', label: 'SQL Query' },
  JDBC: { group: 'Connected Apps', label: 'JDBC Task', docs: 'https://orkes.io/content/reference-docs/system-tasks/jdbc' },
  GRPC: { group: 'Connected Apps', label: 'gRPC Task' },
  DO_WHILE: { group: 'System', label: 'Do While', docs: `${docsRoot}/do-while-task` },
  SWITCH: { group: 'System', label: 'Switch', docs: `${docsRoot}/switch-task` },
  DECISION: { group: 'System', label: 'Decision', docs: `${docsRoot}/decision-task` },
  FORK_JOIN: { group: 'System', label: 'Fork/Join', docs: `${docsRoot}/fork-task` },
  FORK_JOIN_DYNAMIC: { group: 'System', label: 'Dynamic Fork', docs: `${docsRoot}/dynamic-fork-task` },
  JOIN: { group: 'System', label: 'Join', docs: `${docsRoot}/join-task` },
  DYNAMIC: { group: 'System', label: 'Dynamic', docs: `${docsRoot}/dynamic-task` },
  SUB_WORKFLOW: { group: 'System', label: 'Sub Workflow', docs: `${docsRoot}/sub-workflow-task` },
  START_WORKFLOW: { group: 'System', label: 'Start Workflow', docs: `${docsRoot}/start-workflow` },
  TERMINATE: { group: 'System', label: 'Terminate', docs: `${docsRoot}/terminate-task` },
  TERMINATE_WORKFLOW: { group: 'System', label: 'Terminate Workflow', docs: `${docsRoot}/system-tasks/terminate-workflow` },
  WAIT: { group: 'System', label: 'Wait', docs: `${docsRoot}/wait-task` },
  WAIT_FOR_EVENT: { group: 'System', label: 'Wait for Event' },
  WAIT_FOR_WEBHOOK: { group: 'System', label: 'Wait for Webhook' },
  SET_VARIABLE: { group: 'System', label: 'Set Variable', docs: `${docsRoot}/set-variable-task` },
  GET_WORKFLOW: { group: 'System', label: 'Get Workflow', docs: `${docsRoot}/operators/get-workflow` },
  YIELD: { group: 'System', label: 'Yield', docs: `${docsRoot}/operators/yield` },
  HUMAN: { group: 'System', label: 'Human Task' },
  AI_CHAT_COMPLETION: { group: 'AI', label: 'AI Chat Completion' },
  AI_GENERATE_IMAGE: { group: 'AI', label: 'AI Generate Image' },
  LLM_TEXT_COMPLETE: { group: 'AI', label: 'LLM Text Complete' },
  LLM_CHAT_COMPLETE: { group: 'AI', label: 'LLM Chat Complete' },
  LLM_GENERATE_EMBEDDINGS: { group: 'AI', label: 'LLM Generate Embeddings' },
  LLM_GET_EMBEDDINGS: { group: 'AI', label: 'LLM Get Embeddings' },
  LLM_STORE_EMBEDDINGS: { group: 'AI', label: 'LLM Store Embeddings' },
  LLM_SEARCH_INDEX: { group: 'AI', label: 'LLM Search Index' },
  LLM_SEARCH_EMBEDDINGS: { group: 'AI', label: 'LLM Search Embeddings' },
  LLM_INDEX_DOCUMENT: { group: 'AI', label: 'LLM Index Document' },
  LLM_INDEX_TEXT: { group: 'AI', label: 'LLM Index Text' },
  GET_DOCUMENT: { group: 'AI', label: 'Get Document' },
  CHUNK_TEXT: { group: 'AI', label: 'Chunk Text' },
  LIST_FILES: { group: 'AI', label: 'List Files' },
  PARSE_DOCUMENT: { group: 'AI', label: 'Parse Document' },
  AGENT: { group: 'Agentic Orchestration', label: 'Agent' },
  GET_AGENT_CARD: { group: 'Agentic Orchestration', label: 'Get Agent Card' },
  CANCEL_AGENT: { group: 'Agentic Orchestration', label: 'Cancel Agent' },
  LIST_MCP_TOOLS: { group: 'Agentic Orchestration', label: 'List MCP Tools' },
  CALL_MCP_TOOL: { group: 'Agentic Orchestration', label: 'Call MCP Tool' },
  GENERATE_IMAGE: { group: 'Agentic Orchestration', label: 'Generate Image' },
  GENERATE_AUDIO: { group: 'Agentic Orchestration', label: 'Generate Audio' },
  GENERATE_VIDEO: { group: 'Agentic Orchestration', label: 'Generate Video' },
  GENERATE_PDF: { group: 'Agentic Orchestration', label: 'Generate PDF' },
}

export function getTaskFormDefinition(kind: TaskKind): TaskFormDefinition {
  return definitions[kind] ?? { group: 'Generic', label: kind }
}
