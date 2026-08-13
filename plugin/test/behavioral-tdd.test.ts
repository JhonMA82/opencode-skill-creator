import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { dirname, join } from "path"

import { afterEach, expect, test } from "bun:test"

import {
  baselinePolicyForType,
  collectRationalizations,
  loadRegressionSuite,
  promoteToRegression,
  resolveRegressionCase,
  validateBehavioralCases,
} from "../lib/behavioral-tdd"

let tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs = []
})

const newTempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `skill-creator-${prefix}-`))
  tempDirs.push(dir)
  return dir
}

const writeJson = (path: string, data: unknown) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2))
}

// ---------------------------------------------------------------------------
// baselinePolicyForType
// ---------------------------------------------------------------------------

test("baselinePolicyForType maps every skill type to its baseline policy", () => {
  expect(baselinePolicyForType("discipline")).toEqual({
    baseline: "required",
    rationale:
      "imposes rules; without a baseline you cannot prove the rule changes behavior",
  })
  expect(baselinePolicyForType("workflow")).toEqual({
    baseline: "required",
    rationale:
      "coordinates multiple steps; baseline proves the orchestration adds value",
  })
  expect(baselinePolicyForType("technique")).toEqual({
    baseline: "recommended",
    rationale: "teaches a skill; baseline helps but the technique may stand alone",
  })
  expect(baselinePolicyForType("pattern")).toEqual({
    baseline: "recommended",
    rationale: "recognition skills; baseline guards against false application",
  })
  expect(baselinePolicyForType("reference")).toEqual({
    baseline: "optional",
    rationale: "documentary; retrieval value is often self-evident",
  })
  expect(baselinePolicyForType(undefined)).toEqual({
    baseline: "recommended",
    rationale: "default for unclassified skills",
  })
})

// ---------------------------------------------------------------------------
// validateBehavioralCases
// ---------------------------------------------------------------------------

test("validateBehavioralCases accepts an array of cases", () => {
  const result = validateBehavioralCases([
    {
      prompt: "Implement a feature with TDD",
      expected_behavior: ["Writes a failing test first"],
    },
  ])

  expect(result.valid).toBe(true)
  expect(result.errors).toEqual([])
  expect(result.cases).toHaveLength(1)
  expect(result.cases[0].type).toBe("standard")
})

test("validateBehavioralCases accepts the evals.json workspace shape", () => {
  const result = validateBehavioralCases({
    skill_name: "example-skill",
    evals: [
      {
        prompt: "Refactor this module",
        type: "pressure",
        skill_type: "technique",
        expected_behavior: ["Keeps all existing tests green"],
        baseline: { required: true, reason: "Technique value needs proof" },
        tags: ["refactoring"],
      },
    ],
  })

  expect(result.valid).toBe(true)
  expect(result.errors).toEqual([])
  expect(result.cases).toHaveLength(1)
  expect(result.cases[0]).toMatchObject({
    type: "pressure",
    skill_type: "technique",
    prompt: "Refactor this module",
    expected_behavior: ["Keeps all existing tests green"],
    tags: ["refactoring"],
  })
})

test("validateBehavioralCases rejects data that is neither an array nor {evals}", () => {
  const result = validateBehavioralCases({ skill_name: "example-skill" })

  expect(result.valid).toBe(false)
  expect(result.errors).toHaveLength(1)
  expect(result.errors[0]).toContain("array of cases or an object with an evals array")
  expect(result.cases).toEqual([])
})

test("validateBehavioralCases errors when prompt is missing or empty", () => {
  const result = validateBehavioralCases([
    { expected_behavior: ["Does something"] },
    { prompt: "   " },
  ])

  expect(result.valid).toBe(false)
  expect(result.errors).toEqual([
    "case 0: prompt must be a non-empty string",
    "case 1: prompt must be a non-empty string",
  ])
})

test("validateBehavioralCases errors on an unknown case type", () => {
  const result = validateBehavioralCases([{ prompt: "p", type: "easy" }])

  expect(result.valid).toBe(false)
  expect(result.errors).toEqual([
    "case 0: type must be one of standard, pressure, regression",
  ])
})

test("validateBehavioralCases errors on an unknown skill_type", () => {
  const result = validateBehavioralCases([{ prompt: "p", skill_type: "habit" }])

  expect(result.valid).toBe(false)
  expect(result.errors).toEqual([
    "case 0: skill_type must be one of discipline, technique, pattern, reference, workflow",
  ])
})

test("validateBehavioralCases errors on non-string expected_behavior entries", () => {
  const result = validateBehavioralCases([
    { prompt: "p", expected_behavior: ["ok", 42] },
    { prompt: "q", expected_behavior: [""] },
  ])

  expect(result.valid).toBe(false)
  expect(result.errors).toEqual([
    "case 0: expected_behavior must be an array of non-empty strings",
    "case 1: expected_behavior must be an array of non-empty strings",
  ])
})

test("validateBehavioralCases errors on non-string tags", () => {
  const result = validateBehavioralCases([{ prompt: "p", tags: ["ok", 7] }])

  expect(result.valid).toBe(false)
  expect(result.errors).toEqual(["case 0: tags must be an array of strings"])
})

test("validateBehavioralCases warns when a pressure case has no expected_behavior", () => {
  const result = validateBehavioralCases([
    { prompt: "p", type: "pressure" },
    { prompt: "q", type: "regression", expected_behavior: [] },
  ])

  expect(result.valid).toBe(true)
  expect(result.warnings.filter((w) => w.includes("no expected_behavior"))).toHaveLength(2)
})

test("validateBehavioralCases warns when a discipline case has no required baseline", () => {
  const result = validateBehavioralCases([
    { prompt: "p", skill_type: "discipline" },
    { prompt: "q", skill_type: "workflow", baseline: { required: false } },
  ])

  expect(result.valid).toBe(true)
  expect(result.warnings.filter((w) => w.includes("baseline.required"))).toHaveLength(2)
})

test("validateBehavioralCases accepts a discipline case with required baseline", () => {
  const result = validateBehavioralCases([
    {
      prompt: "p",
      skill_type: "discipline",
      baseline: { required: true, reason: "Prove the rule changes behavior" },
    },
  ])

  expect(result.valid).toBe(true)
  expect(result.warnings.filter((w) => w.includes("baseline.required"))).toEqual([])
})

test("validateBehavioralCases warns about untyped cases in a typed set", () => {
  const result = validateBehavioralCases([
    { prompt: "p1", skill_type: "discipline" },
    { prompt: "p2" },
  ])

  expect(result.warnings.some((w) => w.includes("inconsistent classification"))).toBe(true)
  expect(result.warnings.some((w) => w.includes("case 1"))).toBe(true)
})

test("validateBehavioralCases derives baseline_policy from the most common skill_type", () => {
  const result = validateBehavioralCases([
    { prompt: "p1", skill_type: "discipline" },
    { prompt: "p2", skill_type: "discipline" },
    { prompt: "p3", skill_type: "technique" },
  ])

  expect(result.baseline_policy).toEqual({
    skill_type: "discipline",
    baseline: "required",
    rationale:
      "imposes rules; without a baseline you cannot prove the rule changes behavior",
  })
})

test("validateBehavioralCases defaults to recommended when no case is typed", () => {
  const result = validateBehavioralCases([{ prompt: "p1" }])

  expect(result.baseline_policy.skill_type).toBeNull()
  expect(result.baseline_policy.baseline).toBe("recommended")
})

// ---------------------------------------------------------------------------
// collectRationalizations
// ---------------------------------------------------------------------------

test("collectRationalizations reads rationalization objects from grading.json files", () => {
  const workspace = newTempDir("rationalization")
  writeJson(join(workspace, "iteration-1", "eval-0", "with_skill", "grading.json"), {
    summary: { passed: 0, failed: 2 },
    rationalization: {
      trigger: "time-pressure",
      agent_reasoning_summary:
        "The agent skipped verification because the change looked too small",
      violated_rule: "Run verification before declaring completion",
      mitigation: "State that verification is mandatory even for small changes",
    },
  })

  const report = collectRationalizations(workspace)
  expect(report.records).toHaveLength(1)
  expect(report.records[0]).toEqual({
    case_id: join("iteration-1", "eval-0"),
    run_id: "with_skill",
    trigger: "time-pressure",
    agent_reasoning_summary:
      "The agent skipped verification because the change looked too small",
    violated_rule: "Run verification before declaring completion",
    mitigation: "State that verification is mandatory even for small changes",
  })
})

test("collectRationalizations reads rationalization_summary arrays and strings", () => {
  const workspace = newTempDir("rationalization-summary")
  writeJson(join(workspace, "eval-1", "grading.json"), {
    rationalization_summary: [
      "The agent skipped the migration dry-run",
      "The agent did not check for existing conventions",
    ],
  })
  writeJson(join(workspace, "eval-2", "grading.json"), {
    rationalization_summary: "The agent skipped verification",
  })

  const report = collectRationalizations(workspace)
  expect(report.records).toHaveLength(3)
  expect(
    report.records.map((r) => r.agent_reasoning_summary).sort(),
  ).toEqual(
    [
      "The agent skipped the migration dry-run",
      "The agent did not check for existing conventions",
      "The agent skipped verification",
    ].sort(),
  )
  expect(
    report.records.find((r) => r.agent_reasoning_summary === "The agent skipped verification")
      ?.case_id,
  ).toBe("eval-2")
})

test("collectRationalizations falls back to observations mentioning skipped rules", () => {
  const workspace = newTempDir("observations")
  writeJson(join(workspace, "eval-3", "grading.json"), {
    observations: [
      "The agent skipped the validation step because it was slow",
      "Output formatting was inconsistent",
    ],
  })

  const report = collectRationalizations(workspace)
  expect(report.records).toHaveLength(1)
  expect(report.records[0].agent_reasoning_summary).toBe(
    "The agent skipped the validation step because it was slow",
  )
})

test("collectRationalizations ignores grading.json files without rationalization fields", () => {
  const workspace = newTempDir("no-fields")
  writeJson(join(workspace, "eval-4", "grading.json"), {
    summary: { passed: 2, failed: 0 },
  })

  const report = collectRationalizations(workspace)
  expect(report.records).toEqual([])
  expect(report.patterns).toEqual([])
})

test("collectRationalizations skips unparseable grading.json files", () => {
  const workspace = newTempDir("bad-json")
  mkdirSync(join(workspace, "eval-6"), { recursive: true })
  writeFileSync(join(workspace, "eval-6", "grading.json"), "not json")

  const report = collectRationalizations(workspace)
  expect(report.records).toEqual([])
})

test("collectRationalizations finds grading.json files in nested directories", () => {
  const workspace = newTempDir("nested")
  writeJson(join(workspace, "iteration-2", "eval-5", "old_skill", "grading.json"), {
    rationalization_summary: "The agent skipped the final check",
  })

  const report = collectRationalizations(workspace)
  expect(report.records).toHaveLength(1)
  expect(report.records[0].case_id).toBe(join("iteration-2", "eval-5"))
  expect(report.records[0].run_id).toBe("old_skill")
})

test("collectRationalizations returns an empty report for a missing workspace", () => {
  const workspace = join(newTempDir("missing-workspace"), "does-not-exist")

  const report = collectRationalizations(workspace)
  expect(report.records).toEqual([])
  expect(report.patterns).toEqual([])
})

test("collectRationalizations groups patterns by summary sorted by count descending", () => {
  const workspace = newTempDir("patterns")
  const shared =
    "The agent skipped verification because the change looked too small"
  writeJson(join(workspace, "eval-0", "grading.json"), {
    rationalization: { agent_reasoning_summary: shared },
  })
  writeJson(join(workspace, "eval-1", "grading.json"), {
    rationalization: { agent_reasoning_summary: shared },
  })
  writeJson(join(workspace, "eval-2", "grading.json"), {
    rationalization_summary: "The agent skipped the migration dry-run",
  })

  const report = collectRationalizations(workspace)
  expect(report.patterns).toEqual([
    { summary: shared, count: 2 },
    { summary: "The agent skipped the migration dry-run", count: 1 },
  ])
})

// ---------------------------------------------------------------------------
// Regression suite
// ---------------------------------------------------------------------------

test("promoteToRegression creates the suite file when missing", () => {
  const workspace = newTempDir("regression-create")
  const suitePath = join(workspace, "evals", "regression-suite.json")

  const result = promoteToRegression(suitePath, {
    skill_name: "example-skill",
    source: "production-failure",
    origin_case_id: "eval-3",
    prompt: "Fix the broken migration",
    expected_behavior: ["Runs the migration dry-run before applying"],
    rationalization_summary: ["The agent skipped the dry-run"],
  })

  expect(result.added).toBe(true)
  expect(result.case.id).toBe("regression-01")
  expect(result.case.source).toBe("production-failure")
  expect(result.case.origin_case_id).toBe("eval-3")
  expect(result.case.expected_behavior).toEqual([
    "Runs the migration dry-run before applying",
  ])
  expect(result.case.resolved).toBe(false)
  expect(result.case.created_at).toBeString()

  const reloaded = loadRegressionSuite(suitePath)
  expect(reloaded?.skill_name).toBe("example-skill")
  expect(reloaded?.cases).toHaveLength(1)
})

test("promoteToRegression dedupes by prompt case-insensitively after trimming", () => {
  const workspace = newTempDir("regression-dedupe")
  const suitePath = join(workspace, "regression-suite.json")

  const first = promoteToRegression(suitePath, {
    skill_name: "example-skill",
    source: "eval-failure",
    prompt: "  Fix the migration  ",
  })
  const second = promoteToRegression(suitePath, {
    skill_name: "example-skill",
    source: "eval-failure",
    prompt: "fix the MIGRATION",
  })

  expect(first.added).toBe(true)
  expect(second.added).toBe(false)
  expect(second.existing_id).toBe("regression-01")
  expect(second.case.id).toBe("regression-01")
  expect(second.case.prompt).toBe("Fix the migration")
  expect(loadRegressionSuite(suitePath)?.cases).toHaveLength(1)
})

test("promoteToRegression assigns sequential zero-padded ids and persists", () => {
  const workspace = newTempDir("regression-ids")
  const suitePath = join(workspace, "regression-suite.json")

  const first = promoteToRegression(suitePath, {
    skill_name: "example-skill",
    source: "eval-failure",
    prompt: "p1",
  })
  const second = promoteToRegression(suitePath, {
    skill_name: "example-skill",
    source: "eval-failure",
    prompt: "p2",
  })
  const third = promoteToRegression(suitePath, {
    skill_name: "example-skill",
    source: "production-failure",
    prompt: "p3",
  })

  expect(first.case.id).toBe("regression-01")
  expect(second.case.id).toBe("regression-02")
  expect(third.case.id).toBe("regression-03")
  expect(loadRegressionSuite(suitePath)?.cases.map((c) => c.id)).toEqual([
    "regression-01",
    "regression-02",
    "regression-03",
  ])
})

test("resolveRegressionCase marks a case resolved and saves", () => {
  const workspace = newTempDir("regression-resolve")
  const suitePath = join(workspace, "regression-suite.json")

  promoteToRegression(suitePath, {
    skill_name: "example-skill",
    source: "eval-failure",
    prompt: "p1",
  })

  const result = resolveRegressionCase(suitePath, "regression-01")
  expect(result.found).toBe(true)
  expect(result.suite.cases[0].resolved).toBe(true)
  expect(loadRegressionSuite(suitePath)?.cases[0].resolved).toBe(true)
})

test("resolveRegressionCase returns found=false for a missing id", () => {
  const workspace = newTempDir("regression-resolve-missing")
  const suitePath = join(workspace, "regression-suite.json")

  promoteToRegression(suitePath, {
    skill_name: "example-skill",
    source: "eval-failure",
    prompt: "p1",
  })

  const result = resolveRegressionCase(suitePath, "regression-99")
  expect(result.found).toBe(false)
  expect(loadRegressionSuite(suitePath)?.cases[0].resolved).toBe(false)
})

test("resolveRegressionCase returns found=false when the suite is missing", () => {
  const workspace = newTempDir("regression-resolve-no-suite")

  const result = resolveRegressionCase(join(workspace, "nope.json"), "regression-01")
  expect(result.found).toBe(false)
})

test("loadRegressionSuite returns null for a missing file", () => {
  const workspace = newTempDir("regression-load-missing")

  expect(loadRegressionSuite(join(workspace, "missing.json"))).toBeNull()
})

test("loadRegressionSuite returns null for invalid JSON", () => {
  const workspace = newTempDir("regression-load-invalid")
  const suitePath = join(workspace, "regression-suite.json")
  mkdirSync(dirname(suitePath), { recursive: true })
  writeFileSync(suitePath, "not json")

  expect(loadRegressionSuite(suitePath)).toBeNull()
})

test("loadRegressionSuite returns null for a shape without a cases array", () => {
  const workspace = newTempDir("regression-load-shape")
  const suitePath = join(workspace, "regression-suite.json")
  writeJson(suitePath, { skill_name: "example-skill" })

  expect(loadRegressionSuite(suitePath)).toBeNull()
})
