import type { PlanningRule } from './model.js'
import { parseAssistanceProposal, type AssistanceProposal } from './assistance-contract.js'
import { planningRuleSchema } from './schema.js'
import {
  parseStructuredSyntheticRequest,
  type StructuredSyntheticRequest,
} from './synthetic-request.js'

export interface AcceptedPlanningRuleSuggestion {
  rule: PlanningRule
  rationale: string
  inputPaths: string[]
}

function parsedProposal(value: unknown): AssistanceProposal {
  return parseAssistanceProposal(value)
}

export function acceptSyntheticSpecDraft(value: unknown): StructuredSyntheticRequest {
  const proposal = parsedProposal(value)
  if (proposal.task !== 'synthetic-spec-draft') {
    throw new Error(
      `CG-6003 expected synthetic-spec-draft proposal, received ${proposal.task}`,
    )
  }

  return parseStructuredSyntheticRequest(proposal.specification)
}

export function acceptPlanningRuleSuggestions(
  value: unknown,
  selectedIndexes: number[],
): AcceptedPlanningRuleSuggestion[] {
  const proposal = parsedProposal(value)
  if (proposal.task !== 'planning-rule-suggestions') {
    throw new Error(
      `CG-6003 expected planning-rule-suggestions proposal, received ${proposal.task}`,
    )
  }

  const uniqueIndexes = [...new Set(selectedIndexes)].sort((left, right) => left - right)
  const accepted: AcceptedPlanningRuleSuggestion[] = []

  for (const index of uniqueIndexes) {
    const suggestion = proposal.suggestions[index]
    if (!suggestion) throw new Error(`CG-6004 unknown planning-rule suggestion index: ${index}`)

    const ruleResult = planningRuleSchema.safeParse(suggestion.rule)
    if (!ruleResult.success) {
      const issue = ruleResult.error.issues[0]
      throw new Error(
        `CG-6005 invalid suggested planning rule at index ${index}: ${issue?.message ?? 'validation failed'}`,
      )
    }

    accepted.push({
      rule: ruleResult.data,
      rationale: suggestion.rationale,
      inputPaths: [...suggestion.inputPaths],
    })
  }

  return accepted
}
