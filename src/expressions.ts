export type ExpressionReference = { source: 'workflow.input' | 'workflow.output' | 'workflow.variables' | 'workflow.meta' | 'task.input' | 'task.output' | 'secret' | 'env'; path: string; raw: string; taskReference?: string }

const tokenPattern = /\$\{([^}]+)\}/g

export function extractExpressions(value: string): ExpressionReference[] {
  return [...value.matchAll(tokenPattern)].flatMap((match) => {
    const raw = match[0]
    const expression = match[1].trim()
    const [head, namespace, ...pathParts] = expression.split('.')
    let source: ExpressionReference['source']
    let path: string
    let taskReference: string | undefined
    if (head === 'workflow' && namespace === 'input') { source = 'workflow.input'; path = pathParts.join('.') }
    else if (head === 'workflow' && namespace === 'output') { source = 'workflow.output'; path = pathParts.join('.') }
    else if (head === 'workflow' && (namespace === 'variable' || namespace === 'variables')) { source = 'workflow.variables'; path = pathParts.join('.') }
    else if (head === 'workflow' && (namespace === 'secrets' || namespace === 'secret')) { source = 'secret'; path = pathParts.join('.') }
    else if (head === 'workflow' && namespace === 'env') { source = 'env'; path = pathParts.join('.') }
    else if (head === 'workflow') { source = 'workflow.meta'; path = [namespace, ...pathParts].filter(Boolean).join('.') }
    else if (head === 'secret') { source = 'secret'; path = [namespace, ...pathParts].filter(Boolean).join('.') }
    else if (head === 'env') { source = 'env'; path = [namespace, ...pathParts].filter(Boolean).join('.') }
    else { taskReference = head; source = namespace === 'input' ? 'task.input' : 'task.output'; path = pathParts.join('.') }
    return [{ source, path, raw, ...(taskReference ? { taskReference } : {}) }]
  })
}

export function validateExpressions(value: string, knownRefs: string[]) {
  return extractExpressions(value).filter((reference) => (reference.source === 'task.input' || reference.source === 'task.output') && Boolean(reference.taskReference) && !knownRefs.includes(reference.taskReference!)).map((reference) => `Unknown task reference in ${reference.raw}.`)
}
