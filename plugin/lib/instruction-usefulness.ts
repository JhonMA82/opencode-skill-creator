/**
 * Instruction usefulness — decide whether an instruction earns its context
 * cost by measuring how much agent behavior changes with vs without it.
 *
 * The failure mode this guards against is the "Write clean, maintainable
 * code" problem: instructions that sound good but do not measurably change
 * behavior. Every token they consume in the skill is wasted context budget.
 *
 * Two entry points share one evidence-based core:
 * - `assessInstructionUsefulness` (rate-based, backwards-compatible): takes
 *   pass rates plus run counts, derives the integer pass counts, validates
 *   that each rate is coherent with its count (a rate like 0.55 with 5 runs
 *   would imply 2.75 passed — impossible for binary trials), then delegates.
 * - `assessInstructionUsefulnessFromEvidence` (canonical): takes the raw
 *   integer evidence (passed/runs per side) directly.
 *
 * The verdict is sample-size aware, interval-based, and threshold-based; the
 * thresholds are documented heuristics, not universal rules.
 */

export interface UsefulnessInput {
  baseline_pass_rate: number // 0..1 — pass rate WITHOUT the instruction
  with_instruction_pass_rate: number // 0..1 — pass rate WITH the instruction
  baseline_runs: number // sample size for baseline
  with_runs: number // sample size for with-instruction
  instruction_text?: string // optional — the instruction being assessed
}

export interface UsefulnessEvidenceInput {
  baseline: { passed: number; runs: number } // integer evidence WITHOUT the instruction
  with_instruction: { passed: number; runs: number } // integer evidence WITH the instruction
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
  baseline_passed: number // integer evidence derived from / passed to the input
  with_instruction_passed: number
  recommendation: UsefulnessRecommendation
  rationale: string // human-readable explanation of the verdict
  instruction_text?: string
}

const MIN_RUNS_PER_SIDE = 5
const REMOVE_DELTA = 0.02
const KEEP_DELTA = 0.05
const NOOP_BASELINE = 0.95
const NOOP_MAX_DELTA = 0.03
const WILSON_Z = 1.96 // z-score for a 95% confidence interval

function round4(value: number): number {
  const rounded = Math.round(value * 10000) / 10000
  // Normalize -0 to 0 so JSON output and comparisons stay clean.
  return rounded === 0 ? 0 : rounded
}

function formatDelta(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`
}

/**
 * Wilson score interval (95%) for a binomial proportion.
 *
 * Chosen over the normal approximation because it stays well-behaved near
 * p = 0 and p = 1 and remains conservative at small sample sizes. For a
 * proportion p = passed / runs and z = 1.96 (95% confidence):
 *
 *   center = (p + z^2 / (2n)) / (1 + z^2 / n)
 *   half   = z * sqrt(p(1-p)/n + z^2 / (4n^2)) / (1 + z^2 / n)
 *   lower  = max(0, center - half)
 *   upper  = min(1, center + half)
 *
 * The interval is centered on a weighted blend of p and 0.5, so it never
 * collapses to a point at p = 0 or p = 1 and never escapes [0, 1].
 */
function wilsonInterval(passed: number, runs: number): { lower: number; upper: number } {
  const p = passed / runs
  const z2 = WILSON_Z * WILSON_Z
  const denominator = 1 + z2 / runs
  const center = (p + z2 / (2 * runs)) / denominator
  const half =
    (WILSON_Z * Math.sqrt((p * (1 - p)) / runs + z2 / (4 * runs * runs))) / denominator
  return {
    lower: Math.max(0, center - half),
    upper: Math.min(1, center + half),
  }
}

/**
 * Shared evidence-based core behind both public entry points.
 *
 * Decision tree (after validation), evaluated in this order:
 * 1. `sample_size` = min(baseline_runs, with_runs); when < MIN_RUNS_PER_SIDE
 *    → `insufficient-data` — too few runs per side to separate signal from
 *    noise.
 * 2. `delta` = round4(with_rate - baseline_rate).
 * 3. No-op override: baseline_rate >= NOOP_BASELINE AND delta <= NOOP_MAX_DELTA
 *    → `remove` — the agent already performs the behavior consistently
 *    without the instruction, so it adds context cost without changing
 *    behavior. The override only applies at delta <= 0.03, so a high-baseline
 *    skill with a real gain still reaches the keep rule.
 * 4. delta <= REMOVE_DELTA → `remove` — the change does not justify the
 *    context cost. When delta < 0 the instruction makes behavior worse, which
 *    is called out explicitly (a regression must never be kept).
 * 5. delta >= KEEP_DELTA AND the Wilson 95% intervals do not overlap
 *    (with-instruction lower bound > baseline upper bound) → `keep`. The
 *    interval overlap check is what makes the verdict statistically
 *    defensible: a large delta on a tiny sample (e.g. 0.40 → 0.60 with 5 runs
 *    per side) still leaves overlapping intervals and therefore falls through
 *    to `review` instead of being kept.
 * 6. Otherwise → `review` — delta is not statistically significant (too
 *    small, or intervals overlap): run more samples or inspect transcripts
 *    before deciding.
 */
function assessFromEvidence(evidence: {
  baseline_passed: number
  baseline_runs: number
  with_passed: number
  with_runs: number
  instruction_text?: string
}): UsefulnessResult {
  const baseline_rate = evidence.baseline_passed / evidence.baseline_runs
  const with_rate = evidence.with_passed / evidence.with_runs
  const delta = round4(with_rate - baseline_rate)
  const sample_size = Math.min(evidence.baseline_runs, evidence.with_runs)

  let recommendation: UsefulnessRecommendation
  let rationale: string

  if (sample_size < MIN_RUNS_PER_SIDE) {
    recommendation = "insufficient-data"
    rationale = `insufficient-data: sample too small to distinguish signal from noise (need at least ${MIN_RUNS_PER_SIDE} runs per side)`
  } else if (baseline_rate >= NOOP_BASELINE && delta <= NOOP_MAX_DELTA) {
    recommendation = "remove"
    rationale = `remove: the agent already performs the behavior consistently without the instruction (delta ${formatDelta(delta)}); the instruction is a no-op`
  } else if (delta <= REMOVE_DELTA) {
    recommendation = "remove"
    if (delta < 0) {
      rationale = evidence.instruction_text
        ? `remove: instruction '${evidence.instruction_text}' makes behavior worse (delta ${formatDelta(delta)})`
        : `remove: the instruction makes behavior worse (delta ${formatDelta(delta)})`
    } else {
      rationale = evidence.instruction_text
        ? `remove: instruction '${evidence.instruction_text}' shows no meaningful behavioral change (delta ${formatDelta(delta)})`
        : `remove: delta ${formatDelta(delta)} or less does not justify the context cost of the instruction`
    }
  } else if (delta >= KEEP_DELTA) {
    const baseline_interval = wilsonInterval(evidence.baseline_passed, evidence.baseline_runs)
    const with_interval = wilsonInterval(evidence.with_passed, evidence.with_runs)
    if (with_interval.lower > baseline_interval.upper) {
      recommendation = "keep"
      rationale = `keep: instruction shows a meaningful behavioral improvement (delta ${formatDelta(delta)})`
    } else {
      recommendation = "review"
      rationale = `review: delta ${formatDelta(delta)} is not statistically significant; run more samples or review the transcript quality before deciding`
    }
  } else {
    recommendation = "review"
    rationale = `review: delta ${formatDelta(delta)} is not statistically significant; run more samples or review the transcript quality before deciding`
  }

  const result: UsefulnessResult = {
    baseline_pass_rate: round4(baseline_rate),
    with_instruction_pass_rate: round4(with_rate),
    delta,
    baseline_runs: evidence.baseline_runs,
    with_runs: evidence.with_runs,
    sample_size,
    baseline_passed: evidence.baseline_passed,
    with_instruction_passed: evidence.with_passed,
    recommendation,
    rationale,
  }

  if (evidence.instruction_text) {
    result.instruction_text = evidence.instruction_text
  }

  return result
}

/**
 * Rate-based entry point (backwards-compatible).
 *
 * Validates the input, derives the integer pass counts, and rejects
 * incoherent rate/count combinations — a pass rate must be exactly
 * expressible as passed / runs for binary trials (e.g. 0.55 with 5 runs would
 * imply 2.75 passed and is impossible).
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

  const baseline_passed = Math.round(baseline_pass_rate * baseline_runs)
  if (Math.abs(baseline_pass_rate - baseline_passed / baseline_runs) > 1e-9) {
    throw new Error(
      `pass rate ${baseline_pass_rate} is impossible for ${baseline_runs} runs (would imply ${baseline_passed} passed)`,
    )
  }

  const with_passed = Math.round(with_instruction_pass_rate * with_runs)
  if (Math.abs(with_instruction_pass_rate - with_passed / with_runs) > 1e-9) {
    throw new Error(
      `pass rate ${with_instruction_pass_rate} is impossible for ${with_runs} runs (would imply ${with_passed} passed)`,
    )
  }

  return assessFromEvidence({
    baseline_passed,
    baseline_runs,
    with_passed,
    with_runs,
    instruction_text: input.instruction_text,
  })
}

/**
 * Canonical integer-evidence entry point.
 *
 * Takes the raw passed/runs counts per side — no rounding ambiguity, no
 * impossible-rate surface. Rates are derived as passed / runs and the
 * decision tree above applies unchanged.
 */
export function assessInstructionUsefulnessFromEvidence(
  input: UsefulnessEvidenceInput,
): UsefulnessResult {
  validateEvidence(input.baseline.passed, input.baseline.runs)
  validateEvidence(input.with_instruction.passed, input.with_instruction.runs)

  return assessFromEvidence({
    baseline_passed: input.baseline.passed,
    baseline_runs: input.baseline.runs,
    with_passed: input.with_instruction.passed,
    with_runs: input.with_instruction.runs,
    instruction_text: input.instruction_text,
  })
}

function validateEvidence(passed: number, runs: number): void {
  if (!Number.isInteger(passed) || passed < 0) {
    throw new Error("passed counts must be non-negative integers")
  }
  if (!Number.isInteger(runs) || runs <= 0) {
    throw new Error("run counts must be positive integers")
  }
  if (passed > runs) {
    throw new Error("passed cannot exceed runs")
  }
}
