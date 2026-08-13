/**
 * Evidence-driven tool registrations (fork-specific).
 *
 * These tools extend the upstream skill-creator plugin with behavioral
 * evidence gathering: context/token budget linting, behavioral case
 * validation, rationalization collection, the regression suite, and
 * instruction-usefulness assessment.
 *
 * They live in their own module so the upstream-owned entrypoint
 * (skill-creator.ts) stays close to upstream and the fork diff shrinks.
 * Tool names, descriptions, and execute behavior must stay identical to the
 * historical in-entrypoint registrations.
 */

import { tool } from "@opencode-ai/plugin"

import { lintSkillContext } from "./context-budget"
import {
  collectRationalizations,
  loadRegressionSuite,
  promoteToRegression,
  resolveRegressionCase,
  validateBehavioralCases,
} from "./behavioral-tdd"
import { assessInstructionUsefulness } from "./instruction-usefulness"

/**
 * Register the fork's evidence-driven tools as one tool-object spread.
 */
export function createEvidenceDrivenTools() {
  return {
    // ---------------------------------------------------------------
    // skill_context_lint — lint context/token budget
    // ---------------------------------------------------------------
    skill_context_lint: tool({
      description:
        "Lint a skill's context/token budget: SKILL.md size and estimated tokens, references count and depth, largest reference, duplicate sections, examples count, and progressive-disclosure suggestions. Budgets are configurable per call; warnings are advisory.",
      args: {
        skillPath: tool.schema
          .string()
          .describe("Path to the skill directory containing SKILL.md"),
        budgets: tool.schema
          .object({
            skill_md: tool.schema
              .object({
                warning_words: tool.schema.number().optional(),
                error_words: tool.schema.number().nullable().optional(),
              })
              .optional(),
            frequent_skill: tool.schema
              .object({
                warning_words: tool.schema.number().optional(),
              })
              .optional(),
            reference_depth: tool.schema
              .object({
                warning: tool.schema.number().optional(),
              })
              .optional(),
          })
          .optional()
          .describe(
            "Optional budget overrides (defaults: skill_md.warning_words 500, skill_md.error_words null, frequent_skill.warning_words 250, reference_depth.warning 2)",
          ),
      },
      async execute(args) {
        return JSON.stringify(lintSkillContext(args.skillPath, args.budgets), null, 2)
      },
    }),

    // ---------------------------------------------------------------
    // skill_validate_cases — validate a behavioral case set
    // ---------------------------------------------------------------
    skill_validate_cases: tool({
      description:
        "Validate a behavioral case set (evals/evals.json) for the behavioral TDD workflow. Accepts an array of cases or {evals: [...]}. Checks prompt, type, skill_type, expected_behavior, and tags, and reports the baseline policy derived from the most common skill type.",
      args: {
        casesPath: tool.schema
          .string()
          .describe("Path to the behavioral case set JSON (array of cases or {evals: [...]})"),
        strict: tool.schema
          .boolean()
          .optional()
          .describe("When true, missing required baseline or expected_behavior for the relevant case types becomes a validation error instead of a warning"),
      },
      async execute(args) {
        const { readFileSync } = await import("fs")
        const data = JSON.parse(readFileSync(args.casesPath, "utf-8"))
        const result = validateBehavioralCases(data, { strict: args.strict === true })
        return JSON.stringify(
          {
            valid: result.valid,
            errors: result.errors,
            warnings: result.warnings,
            case_count: result.cases.length,
            baseline_policy: result.baseline_policy,
          },
          null,
          2,
        )
      },
    }),

    // ---------------------------------------------------------------
    // skill_collect_rationalizations — collect failure explanations
    // ---------------------------------------------------------------
    skill_collect_rationalizations: tool({
      description:
        "Collect observable rationalization records from every grading.json under a workspace: what pressured the agent, the observable summary of why it failed, and any violated rule or mitigation. Only explicit summary fields are read — never private chain-of-thought.",
      args: {
        workspace: tool.schema
          .string()
          .describe("Path to the workspace directory containing grading.json files"),
      },
      async execute(args) {
        const report = collectRationalizations(args.workspace)
        return JSON.stringify(
          {
            record_count: report.records.length,
            records: report.records,
            patterns: report.patterns,
          },
          null,
          2,
        )
      },
    }),

    // ---------------------------------------------------------------
    // skill_regression_suite — manage the regression suite
    // ---------------------------------------------------------------
    skill_regression_suite: tool({
      description:
        "Manage the regression suite for a skill: promote a real behavioral failure to a permanent regression case (deduped by prompt), list existing cases, or mark a case resolved.",
      args: {
        action: tool.schema
          .enum(["add", "list", "resolve"])
          .describe("Action: add a regression case, list the suite, or resolve a case"),
        suitePath: tool.schema
          .string()
          .describe("Path to the regression suite JSON file (e.g. <skill>/evals/regression-suite.json)"),
        skillName: tool.schema
          .string()
          .optional()
          .describe("Skill name (required for add when the suite does not exist yet)"),
        source: tool.schema
          .enum(["production-failure", "eval-failure"])
          .optional()
          .describe("Failure source (defaults to eval-failure for add)"),
        originCaseId: tool.schema
          .string()
          .optional()
          .describe("Origin eval case id for the failure"),
        prompt: tool.schema
          .string()
          .optional()
          .describe("Minimal reproducible prompt (required for add)"),
        expectedBehavior: tool.schema
          .array(tool.schema.string())
          .optional()
          .describe("Expected observable behaviors"),
        rationalizationSummary: tool.schema
          .array(tool.schema.string())
          .optional()
          .describe("Observable rationalization summaries for the failure"),
        id: tool.schema
          .string()
          .optional()
          .describe("Regression case id (required for resolve)"),
      },
      async execute(args) {
        switch (args.action) {
          case "add": {
            if (!args.skillName) {
              throw new Error("skill_regression_suite add requires skillName")
            }
            if (!args.prompt) {
              throw new Error("skill_regression_suite add requires prompt")
            }
            const result = promoteToRegression(args.suitePath, {
              skill_name: args.skillName,
              source: args.source ?? "eval-failure",
              origin_case_id: args.originCaseId,
              prompt: args.prompt,
              expected_behavior: args.expectedBehavior,
              rationalization_summary: args.rationalizationSummary,
            })
            return JSON.stringify(
              {
                added: result.added,
                existing_id: result.existing_id,
                case: result.case,
              },
              null,
              2,
            )
          }
          case "list": {
            const suite = loadRegressionSuite(args.suitePath)
            return JSON.stringify({ cases: suite?.cases ?? [] }, null, 2)
          }
          case "resolve": {
            if (!args.id) {
              throw new Error("skill_regression_suite resolve requires id")
            }
            const result = resolveRegressionCase(args.suitePath, args.id)
            const resolvedCase = result.found
              ? (result.suite.cases.find((c) => c.id === args.id) ?? null)
              : null
            return JSON.stringify(
              { found: result.found, case: resolvedCase },
              null,
              2,
            )
          }
          default:
            throw new Error(`skill_regression_suite unknown action: ${String(args.action)}`)
        }
      },
    }),

    // skill_instruction_usefulness — assess instruction context cost
    // ---------------------------------------------------------------
    skill_instruction_usefulness: tool({
      description:
        "Assess whether a specific skill instruction changes agent behavior enough to justify its context cost. Takes pass rates from baseline (without the instruction) and with-instruction runs and returns a recommendation: keep, review, remove, or insufficient-data.",
      args: {
        baselinePassRate: tool.schema
          .number()
          .describe("Pass rate WITHOUT the instruction, as a decimal from 0 to 1"),
        withInstructionPassRate: tool.schema
          .number()
          .describe("Pass rate WITH the instruction, as a decimal from 0 to 1"),
        baselineRuns: tool.schema
          .number()
          .describe("Number of baseline runs (sample size; at least 5 recommended)"),
        withRuns: tool.schema
          .number()
          .describe("Number of with-instruction runs (sample size; at least 5 recommended)"),
        instructionText: tool.schema
          .string()
          .optional()
          .describe("The instruction being assessed (optional; echoed in the output)"),
      },
      async execute(args) {
        const result = assessInstructionUsefulness({
          baseline_pass_rate: args.baselinePassRate,
          with_instruction_pass_rate: args.withInstructionPassRate,
          baseline_runs: args.baselineRuns,
          with_runs: args.withRuns,
          instruction_text: args.instructionText,
        })
        return JSON.stringify(result, null, 2)
      },
    }),
  }
}
