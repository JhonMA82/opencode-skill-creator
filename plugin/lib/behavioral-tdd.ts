/**
 * Behavioral TDD — skill-type classification, behavioral case validation,
 * rationalization collection, and the regression suite store.
 *
 * Behavioral TDD extends trigger evals with observable-behavior testing:
 * classify the skill type, define expected behaviors per case, capture
 * observable failure explanations (NEVER chain-of-thought), and hold every
 * real behavioral failure as a permanent regression case.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "fs"
import { basename, dirname, join, relative, sep } from "path"

// ---------------------------------------------------------------------------
// Skill type taxonomy
// ---------------------------------------------------------------------------

export const SKILL_TYPES = [
  "discipline",
  "technique",
  "pattern",
  "reference",
  "workflow",
] as const

export type SkillType = (typeof SKILL_TYPES)[number]

export type CaseType = "standard" | "pressure" | "regression"

// ---------------------------------------------------------------------------
// Behavioral case validation
// ---------------------------------------------------------------------------

export interface BehavioralCase {
  id?: string
  type?: CaseType // default "standard"
  skill_type?: SkillType // optional; if present must be one of SKILL_TYPES
  intent?: string // what behavior the case probes
  prompt: string
  expected_behavior?: string[] // observable behaviors the agent must exhibit
  baseline?: { required?: boolean; reason?: string } // baseline policy override for this case
  tags?: string[]
}

export interface CaseValidationResult {
  valid: boolean
  errors: string[] // structural problems (fail the validation)
  warnings: string[] // policy suggestions (do not fail)
  cases: BehavioralCase[]
  baseline_policy: {
    skill_type: SkillType | null
    baseline: "required" | "recommended" | "optional"
    rationale: string
  }
}

const CASE_TYPES: CaseType[] = ["standard", "pressure", "regression"]

export function baselinePolicyForType(
  type: SkillType | undefined,
): {
  baseline: "required" | "recommended" | "optional"
  rationale: string
} {
  switch (type) {
    case "discipline":
      return {
        baseline: "required",
        rationale:
          "imposes rules; without a baseline you cannot prove the rule changes behavior",
      }
    case "workflow":
      return {
        baseline: "required",
        rationale:
          "coordinates multiple steps; baseline proves the orchestration adds value",
      }
    case "technique":
      return {
        baseline: "recommended",
        rationale: "teaches a skill; baseline helps but the technique may stand alone",
      }
    case "pattern":
      return {
        baseline: "recommended",
        rationale: "recognition skills; baseline guards against false application",
      }
    case "reference":
      return {
        baseline: "optional",
        rationale: "documentary; retrieval value is often self-evident",
      }
    default:
      return {
        baseline: "recommended",
        rationale: "default for unclassified skills",
      }
  }
}

function isSkillType(value: unknown): value is SkillType {
  return typeof value === "string" && (SKILL_TYPES as readonly string[]).includes(value)
}

function isCaseType(value: unknown): value is CaseType {
  return typeof value === "string" && (CASE_TYPES as readonly string[]).includes(value)
}

function mostCommonSkillType(counts: Map<SkillType, number>): SkillType | null {
  let best: SkillType | null = null
  let bestCount = 0
  // Deterministic tie-break: first in SKILL_TYPES order wins.
  for (const type of SKILL_TYPES) {
    const count = counts.get(type) ?? 0
    if (count > bestCount) {
      best = type
      bestCount = count
    }
  }
  return best
}

/**
 * Validate a behavioral case set. Accepts either an array of cases or an
 * object of the form `{ evals: [...] }` (matches the evals.json workspace
 * shape). Structural problems become errors; policy suggestions become
 * warnings.
 */
export function validateBehavioralCases(data: unknown): CaseValidationResult {
  let rawCases: unknown[] = []
  if (Array.isArray(data)) {
    rawCases = data
  } else if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as Record<string, unknown>).evals)
  ) {
    rawCases = (data as Record<string, unknown>).evals as unknown[]
  } else {
    return {
      valid: false,
      errors: [
        "behavioral case set must be an array of cases or an object with an evals array",
      ],
      warnings: [],
      cases: [],
      baseline_policy: {
        skill_type: null,
        ...baselinePolicyForType(undefined),
      },
    }
  }

  const errors: string[] = []
  const warnings: string[] = []
  const cases: BehavioralCase[] = []
  const typeCounts = new Map<SkillType, number>()

  for (const [index, raw] of rawCases.entries()) {
    const label = `case ${index}`
    if (!raw || typeof raw !== "object") {
      errors.push(`${label}: expected an object`)
      continue
    }

    const input = raw as Record<string, unknown>
    const parsed: BehavioralCase = { prompt: "" }

    if (typeof input.id === "string" && input.id.trim()) parsed.id = input.id
    if (typeof input.intent === "string" && input.intent.trim()) {
      parsed.intent = input.intent
    }

    if (typeof input.prompt !== "string" || input.prompt.trim() === "") {
      errors.push(`${label}: prompt must be a non-empty string`)
    } else {
      parsed.prompt = input.prompt
    }

    let caseType: CaseType = "standard"
    if (input.type !== undefined) {
      if (isCaseType(input.type)) {
        caseType = input.type
      } else {
        errors.push(`${label}: type must be one of ${CASE_TYPES.join(", ")}`)
      }
    }
    parsed.type = caseType

    if (input.skill_type !== undefined) {
      if (isSkillType(input.skill_type)) {
        parsed.skill_type = input.skill_type
        typeCounts.set(input.skill_type, (typeCounts.get(input.skill_type) ?? 0) + 1)
      } else {
        errors.push(`${label}: skill_type must be one of ${SKILL_TYPES.join(", ")}`)
      }
    }

    if (input.expected_behavior !== undefined) {
      if (
        !Array.isArray(input.expected_behavior) ||
        input.expected_behavior.some((b) => typeof b !== "string" || b.trim() === "")
      ) {
        errors.push(`${label}: expected_behavior must be an array of non-empty strings`)
      } else {
        parsed.expected_behavior = input.expected_behavior as string[]
      }
    }

    if (input.tags !== undefined) {
      if (!Array.isArray(input.tags) || input.tags.some((t) => typeof t !== "string")) {
        errors.push(`${label}: tags must be an array of strings`)
      } else {
        parsed.tags = input.tags as string[]
      }
    }

    if (input.baseline && typeof input.baseline === "object") {
      parsed.baseline = input.baseline as BehavioralCase["baseline"]
    }

    if (
      (caseType === "pressure" || caseType === "regression") &&
      !(Array.isArray(input.expected_behavior) && input.expected_behavior.length > 0)
    ) {
      warnings.push(
        `${label}: ${caseType} case has no expected_behavior — observable expectations are what make the case fail honestly`,
      )
    }

    if (
      (parsed.skill_type === "discipline" || parsed.skill_type === "workflow") &&
      !(parsed.baseline && parsed.baseline.required === true)
    ) {
      warnings.push(
        `${label}: ${parsed.skill_type} case should declare baseline.required = true`,
      )
    }

    cases.push(parsed)
  }

  const typedCount = cases.filter((c) => c.skill_type !== undefined).length
  if (typedCount > 0) {
    for (const [index, c] of cases.entries()) {
      if (c.skill_type === undefined) {
        warnings.push(
          `case ${index}: no skill_type while other cases in the set are typed — inconsistent classification`,
        )
      }
    }
  }

  const mostCommon = mostCommonSkillType(typeCounts)
  const policy = baselinePolicyForType(mostCommon ?? undefined)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    cases,
    baseline_policy: {
      skill_type: mostCommon ?? null,
      baseline: policy.baseline,
      rationale: policy.rationale,
    },
  }
}

// ---------------------------------------------------------------------------
// Rationalization collection
// ---------------------------------------------------------------------------

export interface RationalizationRecord {
  case_id: string
  run_id?: string
  trigger?: string // what pressured the agent (time-pressure, contradictory-instructions, sunk-cost, ...)
  agent_reasoning_summary: string // OBSERVABLE summary only — NEVER private chain-of-thought
  violated_rule?: string
  mitigation?: string
}

export interface RationalizationReport {
  records: RationalizationRecord[]
  patterns: { summary: string; count: number }[] // grouped by agent_reasoning_summary
}

const MAX_SCAN_DEPTH = 12

/**
 * Recursively find every grading.json under workspaceDir and extract
 * observable rationalization records from it.
 *
 * Only the explicit summary fields are read: the `rationalization` object,
 * `rationalization_summary`, and (as a fallback when neither exists)
 * `observations` entries that mention a rule being skipped. Private model
 * chain-of-thought is never captured.
 */
export function collectRationalizations(workspaceDir: string): RationalizationReport {
  const records: RationalizationRecord[] = []
  collectFromDir(workspaceDir, workspaceDir, 0, records)
  return { records, patterns: groupPatterns(records) }
}

function collectFromDir(
  workspaceDir: string,
  dir: string,
  depth: number,
  records: RationalizationRecord[],
): void {
  if (depth > MAX_SCAN_DEPTH) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFromDir(workspaceDir, fullPath, depth + 1, records)
      continue
    }
    if (!entry.isFile() || entry.name !== "grading.json") continue
    const fileRecords = rationalizationsFromGradingFile(workspaceDir, fullPath)
    if (fileRecords) records.push(...fileRecords)
  }
}

function splitLocation(
  workspaceDir: string,
  filePath: string,
): { case_id: string; run_id?: string } {
  const relativeDir = relative(workspaceDir, dirname(filePath))
  if (!relativeDir || relativeDir === ".") return { case_id: "." }
  const segments = relativeDir.split(sep)
  if (segments.length > 1) {
    return {
      case_id: segments.slice(0, -1).join(sep),
      run_id: segments[segments.length - 1],
    }
  }
  return { case_id: relativeDir }
}

function rationalizationsFromGradingFile(
  workspaceDir: string,
  filePath: string,
): RationalizationRecord[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf-8"))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null

  const grading = parsed as Record<string, unknown>
  const location = splitLocation(workspaceDir, filePath)
  const records: RationalizationRecord[] = []

  const rationalization =
    grading.rationalization && typeof grading.rationalization === "object"
      ? (grading.rationalization as Record<string, unknown>)
      : null

  const summary =
    rationalization && typeof rationalization.agent_reasoning_summary === "string"
      ? rationalization.agent_reasoning_summary.trim()
      : ""
  if (summary) {
    records.push({
      case_id: location.case_id,
      run_id: location.run_id,
      trigger:
        rationalization && typeof rationalization.trigger === "string"
          ? rationalization.trigger
          : undefined,
      agent_reasoning_summary: summary,
      violated_rule:
        rationalization && typeof rationalization.violated_rule === "string"
          ? rationalization.violated_rule
          : undefined,
      mitigation:
        rationalization && typeof rationalization.mitigation === "string"
          ? rationalization.mitigation
          : undefined,
    })
  }

  const summaryField = grading.rationalization_summary
  if (typeof summaryField === "string") {
    if (summaryField.trim()) {
      records.push({
        case_id: location.case_id,
        run_id: location.run_id,
        agent_reasoning_summary: summaryField.trim(),
      })
    }
  } else if (Array.isArray(summaryField)) {
    for (const entry of summaryField) {
      if (typeof entry === "string" && entry.trim()) {
        records.push({
          case_id: location.case_id,
          run_id: location.run_id,
          agent_reasoning_summary: entry.trim(),
        })
      }
    }
  }

  // Fallback: observations only when no explicit rationalization fields exist.
  // Deliberately simple — entries are included verbatim when they mention a
  // rule being skipped.
  if (records.length === 0 && Array.isArray(grading.observations)) {
    for (const observation of grading.observations) {
      if (
        typeof observation === "string" &&
        observation.trim() &&
        /skip/i.test(observation)
      ) {
        records.push({
          case_id: location.case_id,
          run_id: location.run_id,
          agent_reasoning_summary: observation.trim(),
        })
      }
    }
  }

  return records.length > 0 ? records : null
}

function groupPatterns(
  records: RationalizationRecord[],
): { summary: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    counts.set(
      record.agent_reasoning_summary,
      (counts.get(record.agent_reasoning_summary) ?? 0) + 1,
    )
  }
  return [...counts.entries()]
    .map(([summary, count]) => ({ summary, count }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Regression suite
// ---------------------------------------------------------------------------

export interface RegressionCase {
  id: string // "regression-<n>" zero-padded, assigned on promote
  source: "production-failure" | "eval-failure"
  origin_case_id?: string
  prompt: string
  expected_behavior: string[]
  rationalization_summary: string[]
  created_at: string // ISO
  resolved: boolean
}

export interface RegressionSuite {
  skill_name: string
  cases: RegressionCase[]
}

export function loadRegressionSuite(path: string): RegressionSuite | null {
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const candidate = parsed as Record<string, unknown>
    if (typeof candidate.skill_name !== "string") return null
    if (!Array.isArray(candidate.cases)) return null
    return candidate as RegressionSuite
  } catch {
    return null
  }
}

export function saveRegressionSuite(path: string, suite: RegressionSuite): void {
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true })
  const tmpPath = join(dir, `.${basename(path)}.${process.pid}.${Date.now()}.tmp`)
  writeFileSync(tmpPath, JSON.stringify(suite, null, 2))
  renameSync(tmpPath, path)
}

export interface PromoteRegressionInput {
  skill_name: string
  source: "production-failure" | "eval-failure"
  origin_case_id?: string
  prompt: string
  expected_behavior?: string[]
  rationalization_summary?: string[]
}

export function promoteToRegression(
  suitePath: string,
  input: PromoteRegressionInput,
): { suite: RegressionSuite; added: boolean; existing_id?: string; case: RegressionCase } {
  const suite = loadRegressionSuite(suitePath) ?? {
    skill_name: input.skill_name,
    cases: [],
  }
  const normalizedPrompt = input.prompt.trim()
  const duplicate = suite.cases.find(
    (c) => c.prompt.trim().toLowerCase() === normalizedPrompt.toLowerCase(),
  )
  if (duplicate) {
    return { suite, added: false, existing_id: duplicate.id, case: duplicate }
  }

  const regressionCase: RegressionCase = {
    id: `regression-${String(suite.cases.length + 1).padStart(2, "0")}`,
    source: input.source,
    origin_case_id: input.origin_case_id,
    prompt: normalizedPrompt,
    expected_behavior: input.expected_behavior ?? [],
    rationalization_summary: input.rationalization_summary ?? [],
    created_at: new Date().toISOString(),
    resolved: false,
  }
  suite.cases.push(regressionCase)
  saveRegressionSuite(suitePath, suite)
  return { suite, added: true, case: regressionCase }
}

export function resolveRegressionCase(
  suitePath: string,
  id: string,
): { suite: RegressionSuite; found: boolean } {
  const suite = loadRegressionSuite(suitePath)
  if (!suite) {
    return { suite: { skill_name: "", cases: [] }, found: false }
  }
  const target = suite.cases.find((c) => c.id === id)
  if (!target) return { suite, found: false }
  target.resolved = true
  saveRegressionSuite(suitePath, suite)
  return { suite, found: true }
}
