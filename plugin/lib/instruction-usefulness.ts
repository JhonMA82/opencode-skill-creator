/**
 * Instruction usefulness — decide whether an instruction earns its context
 * cost by measuring how much agent behavior changes with vs without it.
 *
 * The failure mode this guards against is the "Write clean, maintainable
 * code" problem: instructions that sound good but do not measurably change
 * behavior. Every token they consume in the skill is wasted context budget.
 *
 * The verdict is sample-size aware and threshold-based; the thresholds are
 * documented heuristics, not universal rules.
 */

export interface UsefulnessInput {
  baseline_pass_rate: number // 0..1 — pass rate WITHOUT the instruction
  with_instruction_pass_rate: number // 0..1 — pass rate WITH the instruction
  baseline_runs: number // sample size for baseline
  with_runs: number // sample size for with-instruction
  instruction_text?: string // optional — the instruction being assessed
}

export type UsefulnessRecommendation = "keep" | "review" | "remove" | "insufficient-data"

export interface UsefulnessResult {
  baseline_pass_rate: number
  with_instruction_pass_rate: number
  delta: number // with - baseline, rounded to 4 decimals
  baseline_runs: number
  with_runs: number
  sample_size: number // min(baseline_runs, with_runs)
  recommendation: UsefulnessRecommendation
  rationale: string // human-readable explanation of the verdict
  instruction_text?: string
}

const MIN_RUNS_PER_SIDE = 5
const REMOVE_DELTA = 0.02
const KEEP_DELTA = 0.05
const NOOP_BASELINE = 0.95
const NOOP_MAX_DELTA = 0.03

function round4(value: number): number {
  const rounded = Math.round(value * 10000) / 10000
  // Normalize -0 to 0 so JSON output and comparisons stay clean.
  return rounded === 0 ? 0 : rounded
}

function formatDelta(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`
}

/**
 * Assess whether an instruction changes agent behavior enough to justify its
 * context cost.
 *
 * Decision rules (sample-size aware):
 * 1. `insufficient-data` when min(baseline_runs, with_runs) < 5 — too few
 *    runs per side to separate signal from noise.
 * 2. `remove` when delta <= 0.02 — the change does not justify the context
 *    cost of the instruction.
 * 3. `keep` when delta >= 0.05 — meaningful behavioral improvement.
 * 4. `review` otherwise (0.02 < delta < 0.05) — run more samples or inspect
 *    transcripts before deciding.
 * No-op override: when baseline_pass_rate >= 0.95 AND delta <= 0.03, recommend
 * `remove` because the agent already performs the behavior consistently
 * without the instruction. The override applies only at delta <= 0.03, so a
 * high-baseline skill with a real gain (delta >= 0.05) still recommends keep.
 */
export function assessInstructionUsefulness(input: UsefulnessInput): UsefulnessResult {
  const {
    baseline_pass_rate,
    with_instruction_pass_rate,
    baseline_runs,
    with_runs,
  } = input

  if (
    !Number.isFinite(baseline_pass_rate) ||
    !Number.isFinite(with_instruction_pass_rate) ||
    baseline_pass_rate < 0 ||
    baseline_pass_rate > 1 ||
    with_instruction_pass_rate < 0 ||
    with_instruction_pass_rate > 1
  ) {
    throw new Error("pass rates must be between 0 and 1")
  }

  if (
    !Number.isInteger(baseline_runs) ||
    !Number.isInteger(with_runs) ||
    baseline_runs <= 0 ||
    with_runs <= 0
  ) {
    throw new Error("run counts must be positive integers")
  }

  const instructionText = input.instruction_text?.trim() || undefined
  const delta = round4(with_instruction_pass_rate - baseline_pass_rate)
  const sample_size = Math.min(baseline_runs, with_runs)

  let recommendation: UsefulnessRecommendation
  let rationale: string

  if (sample_size < MIN_RUNS_PER_SIDE) {
    recommendation = "insufficient-data"
    rationale = `insufficient-data: sample too small to distinguish signal from noise (need at least ${MIN_RUNS_PER_SIDE} runs per side)`
  } else if (baseline_pass_rate >= NOOP_BASELINE && delta <= NOOP_MAX_DELTA) {
    // The agent already performs the behavior consistently without the
    // instruction — it adds context cost without changing behavior.
    recommendation = "remove"
    rationale = `remove: the agent already performs the behavior consistently without the instruction (delta ${formatDelta(delta)}); the instruction is a no-op`
  } else if (delta <= REMOVE_DELTA) {
    recommendation = "remove"
    rationale = instructionText
      ? `remove: instruction '${instructionText}' shows no meaningful behavioral change (delta ${formatDelta(delta)})`
      : `remove: delta ${formatDelta(delta)} or less does not justify the context cost of the instruction`
  } else if (delta >= KEEP_DELTA) {
    recommendation = "keep"
    rationale = `keep: instruction shows a meaningful behavioral improvement (delta ${formatDelta(delta)})`
  } else {
    recommendation = "review"
    rationale = `review: delta is between +0.02 and +0.05; run more samples or review the transcript quality before deciding`
  }

  const result: UsefulnessResult = {
    baseline_pass_rate,
    with_instruction_pass_rate,
    delta,
    baseline_runs,
    with_runs,
    sample_size,
    recommendation,
    rationale,
  }

  if (instructionText) {
    result.instruction_text = instructionText
  }

  return result
}
