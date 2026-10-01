import type {
  PlanningRuleSuggestionProposal,
} from './assistance-contract.js'
import type { ClassGraphProject, PlanningRule } from './model.js'
import { planningRuleSchema } from './schema.js'

function pairKey(kind: 'prefer-together' | 'prefer-apart', left: string, right: string): string {
  const pair = [left, right].sort((a, b) => a.localeCompare(b))
  return `${kind}:${pair[0]}:${pair[1]}`
}

function existingPairRules(project: ClassGraphProject): Set<string> {
  const keys = new Set<string>()
  for (const rule of project.planning?.rules ?? []) {
    if (rule.kind === 'prefer-together' || rule.kind === 'prefer-apart') {
      keys.add(pairKey(rule.kind, rule.studentAId, rule.studentBId))
    }
  }
  return keys
}

export function draftPlanningRuleSuggestions(
  project: ClassGraphProject,
  requestId: string,
  providerLabel?: string,
): PlanningRuleSuggestionProposal {
  const warnings: string[] = []
  const assumptions = [
    'Relationship-derived suggestions are soft preferences by default; assistance does not silently promote them to hard constraints.',
  ]
  const existing = existingPairRules(project)
  const suggestions: PlanningRuleSuggestionProposal['suggestions'] = []

  for (const [index, relationship] of (project.relationships ?? []).entries()) {
    if (relationship.directed) {
      warnings.push(
        `Relationship ${relationship.id} is directed and was not converted to a symmetric seating rule.`,
      )
      continue
    }

    let kind: 'prefer-together' | 'prefer-apart' | null = null
    if (relationship.type === 'avoid-pairing') kind = 'prefer-apart'
    if (relationship.type === 'works-well-with' || relationship.type === 'support-pair') {
      kind = 'prefer-together'
    }

    if (!kind) {
      warnings.push(
        `Relationship ${relationship.id} of type ${relationship.type} was left unchanged because ClassGraph does not infer a planning meaning for that relationship type.`,
      )
      continue
    }

    const key = pairKey(kind, relationship.fromStudentId, relationship.toStudentId)
    if (existing.has(key)) {
      warnings.push(
        `Relationship ${relationship.id} already has an equivalent persisted soft planning rule, so no duplicate was suggested.`,
      )
      continue
    }

    const rule: PlanningRule = planningRuleSchema.parse({
      id: `assistance-${relationship.id}`,
      label: `Suggested from explicit relationship ${relationship.id}`,
      strength: 'soft',
      kind,
      studentAId: relationship.fromStudentId,
      studentBId: relationship.toStudentId,
      weight: 1,
    })

    suggestions.push({
      rule,
      rationale:
        kind === 'prefer-apart'
          ? 'Soft prefer-apart suggestion based only on the explicit avoid-pairing relationship; teacher review is required.'
          : 'Soft prefer-together suggestion based only on the explicit works-well-with/support-pair relationship; teacher review is required.',
      inputPaths: [`/relationships/${index}`],
    })
    existing.add(key)
  }

  if (suggestions.length === 0) {
    warnings.push(
      'No eligible explicit relationships produced a planning-rule suggestion. Metrics, names, notes, and inferred traits were not used to invent relationships.',
    )
  }

  return {
    version: '1.0',
    proposalId: `proposal-${requestId}`,
    requestId,
    task: 'planning-rule-suggestions',
    status: 'proposal',
    ...(providerLabel ? { providerLabel } : {}),
    warnings,
    assumptions,
    suggestions,
  }
}
