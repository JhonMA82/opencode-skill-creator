import { expect, test } from "bun:test"

import {
  assessInstructionUsefulness,
  assessInstructionUsefulnessFromEvidence,
} from "../lib/instruction-usefulness"

// Rate-based fixtures: pass rates must be exactly expressible as passed/runs.
// 100 runs allows fine deltas (0.01 steps) with integer pass counts.
const runs100 = { baseline_runs: 100, with_runs: 100 }

test("throws when pass rates are outside [0, 1]", () => {
  for (const baseline_pass_rate of [-0.01, 1.01]) {
    expect(() =>
      assessInstructionUsefulness({
        baseline_pass_rate,
        with_instruction_pass_rate: 0.5,
        ...runs100,
      }),
    ).toThrow("pass rates must be between 0 and 1")
  }

  for (const with_instruction_pass_rate of [-0.01, 1.01]) {
    expect(() =>
      assessInstructionUsefulness({
        baseline_pass_rate: 0.5,
        with_instruction_pass_rate,
        ...runs100,
      }),
    ).toThrow("pass rates must be between 0 and 1")
  }
})

test("throws when run counts are not positive integers", () => {
  for (const baseline_runs of [2.5, 0, -3]) {
    expect(() =>
      assessInstructionUsefulness({
        baseline_pass_rate: 0.5,
        with_instruction_pass_rate: 0.6,
        baseline_runs,
        with_runs: 5,
      }),
    ).toThrow("run counts must be positive integers")
  }

  for (const with_runs of [2.5, 0, -3]) {
    expect(() =>
      assessInstructionUsefulness({
        baseline_pass_rate: 0.5,
        with_instruction_pass_rate: 0.6,
        baseline_runs: 5,
        with_runs,
      }),
    ).toThrow("run counts must be positive integers")
  }
})

test("throws when a pass rate is impossible for the run count (rate-based API)", () => {
  // 0.55 * 5 = 2.75 passed — impossible for binary trials. The old code
  // accepted this; the compatibility layer now rejects it.
  expect(() =>
    assessInstructionUsefulness({
      baseline_pass_rate: 0.55,
      with_instruction_pass_rate: 0.6,
      baseline_runs: 5,
      with_runs: 5,
    }),
  ).toThrow("pass rate 0.55 is impossible for 5 runs (would imply 3 passed)")

  // 0.8 * 3 = 2.4 passed — likewise impossible.
  expect(() =>
    assessInstructionUsefulness({
      baseline_pass_rate: 0.6, // valid at 5 runs (3/5)
      with_instruction_pass_rate: 0.8,
      baseline_runs: 5,
      with_runs: 3,
    }),
  ).toThrow(/impossible for 3 runs/)

  // 0.5 with 5 runs is also impossible (2.5 passed).
  expect(() =>
    assessInstructionUsefulness({
      baseline_pass_rate: 0.5,
      with_instruction_pass_rate: 0.6,
      baseline_runs: 5,
      with_runs: 5,
    }),
  ).toThrow(/impossible for 5 runs/)
})

test("throws on invalid evidence (evidence-based API)", () => {
  expect(() =>
    assessInstructionUsefulnessFromEvidence({
      baseline: { passed: 6, runs: 5 },
      with_instruction: { passed: 3, runs: 5 },
    }),
  ).toThrow("passed cannot exceed runs")

  expect(() =>
    assessInstructionUsefulnessFromEvidence({
      baseline: { passed: -1, runs: 5 },
      with_instruction: { passed: 3, runs: 5 },
    }),
  ).toThrow("passed counts must be non-negative integers")

  expect(() =>
    assessInstructionUsefulnessFromEvidence({
      baseline: { passed: 2, runs: 0 },
      with_instruction: { passed: 3, runs: 5 },
    }),
  ).toThrow("run counts must be positive integers")

  expect(() =>
    assessInstructionUsefulnessFromEvidence({
      baseline: { passed: 2.5, runs: 5 },
      with_instruction: { passed: 3, runs: 5 },
    }),
  ).toThrow("passed counts must be non-negative integers")

  expect(() =>
    assessInstructionUsefulnessFromEvidence({
      baseline: { passed: 2, runs: 5.5 },
      with_instruction: { passed: 3, runs: 5 },
    }),
  ).toThrow("run counts must be positive integers")
})

test("insufficient-data when either side has fewer than 5 runs", () => {
  const result = assessInstructionUsefulnessFromEvidence({
    baseline: { passed: 1, runs: 3 },
    with_instruction: { passed: 2, runs: 4 },
  })

  expect(result.recommendation).toBe("insufficient-data")
  expect(result.sample_size).toBe(3)
  expect(result.rationale).toContain("insufficient-data")
})

test("remove when delta is <= 0.02", () => {
  const small = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.51,
    ...runs100,
  })
  expect(small.recommendation).toBe("remove")
  expect(small.delta).toBe(0.01)

  const boundary = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.52,
    ...runs100,
  })
  expect(boundary.recommendation).toBe("remove")
  expect(boundary.delta).toBe(0.02)
})

test("keep when delta is >= 0.05 and the confidence intervals do not overlap", () => {
  // The old keep assertion used 0.5 -> 0.55 at 5 runs; that input is now
  // rejected as an impossible rate, and the equivalent small-sample cases
  // fall to review (see the small-sample test below). Keep requires a
  // statistically defensible separation, e.g. 10/30 -> 25/30.
  const strong = assessInstructionUsefulness({
    baseline_pass_rate: 10 / 30,
    with_instruction_pass_rate: 25 / 30,
    baseline_runs: 30,
    with_runs: 30,
  })
  expect(strong.recommendation).toBe("keep")
  expect(strong.delta).toBe(0.5)
  expect(strong.baseline_passed).toBe(10)
  expect(strong.with_instruction_passed).toBe(25)
})

test("small sample with overlapping intervals yields review, not keep", () => {
  // Delta 0.20 at 5 runs per side used to recommend keep; with 5 binary
  // trials the Wilson 95% intervals (0.23..0.88 vs 0.12..0.77) overlap, so
  // the improvement is not statistically defensible.
  const result = assessInstructionUsefulnessFromEvidence({
    baseline: { passed: 2, runs: 5 },
    with_instruction: { passed: 3, runs: 5 },
  })

  expect(result.recommendation).toBe("review")
  expect(result.delta).toBe(0.2)
  expect(result.rationale).toContain("review")
})

test("strong improvement with non-overlapping intervals recommends keep", () => {
  const result = assessInstructionUsefulnessFromEvidence({
    baseline: { passed: 10, runs: 30 },
    with_instruction: { passed: 25, runs: 30 },
  })

  expect(result.recommendation).toBe("keep")
  expect(result.delta).toBe(0.5)
})

test("no meaningful improvement yields review", () => {
  const result = assessInstructionUsefulnessFromEvidence({
    baseline: { passed: 28, runs: 30 },
    with_instruction: { passed: 29, runs: 30 },
  })

  expect(result.recommendation).toBe("review")
  expect(result.delta).toBe(0.0333)
})

test("regression yields remove, never keep", () => {
  const result = assessInstructionUsefulnessFromEvidence({
    baseline: { passed: 24, runs: 30 },
    with_instruction: { passed: 14, runs: 30 },
  })

  expect(result.recommendation).toBe("remove")
  expect(result.delta).toBe(-0.3333)
  expect(result.rationale).toContain("worse")
})

test("review when delta is between 0.02 and 0.05", () => {
  const low = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.53,
    ...runs100,
  })
  expect(low.recommendation).toBe("review")
  expect(low.delta).toBe(0.03)

  const high = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.54,
    ...runs100,
  })
  expect(high.recommendation).toBe("review")
  expect(high.delta).toBe(0.04)
})

test("no-op override: high baseline with negligible delta recommends remove with consistent-behavior rationale", () => {
  const result = assessInstructionUsefulness({
    baseline_pass_rate: 0.97,
    with_instruction_pass_rate: 0.99,
    ...runs100,
  })

  expect(result.recommendation).toBe("remove")
  expect(result.delta).toBe(0.02)
  expect(result.rationale).toContain("consistently")
  expect(result.rationale).toContain("no-op")
})

test("no-op override only applies at delta <= 0.03", () => {
  const review = assessInstructionUsefulness({
    baseline_pass_rate: 0.96,
    with_instruction_pass_rate: 1,
    ...runs100,
  })
  expect(review.delta).toBe(0.04)
  expect(review.recommendation).toBe("review")

  // delta 0.05 at 0.95 baseline used to recommend keep; the Wilson intervals
  // at this sample size still overlap (0.963..1.0 vs 0.933..0.978), so the
  // verdict is review until more samples separate them.
  const overlap = assessInstructionUsefulness({
    baseline_pass_rate: 0.95,
    with_instruction_pass_rate: 1,
    ...runs100,
  })
  expect(overlap.delta).toBe(0.05)
  expect(overlap.recommendation).toBe("review")
})

test("instruction_text is echoed in the result", () => {
  const result = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.51,
    ...runs100,
    instruction_text: "Write clean, maintainable code",
  })

  expect(result.instruction_text).toBe("Write clean, maintainable code")
  expect(result.rationale).toContain("Write clean, maintainable code")
})

test("delta is rounded to 4 decimals", () => {
  const result = assessInstructionUsefulnessFromEvidence({
    baseline: { passed: 9, runs: 30 },
    with_instruction: { passed: 19, runs: 30 },
  })

  expect(result.delta).toBe(0.3333)
})

test("evidence API matches the rate-based API for the same underlying evidence", () => {
  const fromEvidence = assessInstructionUsefulnessFromEvidence({
    baseline: { passed: 10, runs: 30 },
    with_instruction: { passed: 25, runs: 30 },
  })

  const fromRates = assessInstructionUsefulness({
    baseline_pass_rate: 10 / 30,
    with_instruction_pass_rate: 25 / 30,
    baseline_runs: 30,
    with_runs: 30,
  })

  expect(fromEvidence.recommendation).toBe(fromRates.recommendation)
  expect(fromEvidence.rationale).toBe(fromRates.rationale)
  expect(fromEvidence.baseline_passed).toBe(10)
  expect(fromEvidence.with_instruction_passed).toBe(25)
  expect(fromRates.baseline_passed).toBe(10)
  expect(fromRates.with_instruction_passed).toBe(25)
})

test("rationale strings contain the recommendation keyword", () => {
  const remove = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.51,
    ...runs100,
  })
  expect(remove.rationale).toContain("remove")

  const keep = assessInstructionUsefulnessFromEvidence({
    baseline: { passed: 10, runs: 30 },
    with_instruction: { passed: 25, runs: 30 },
  })
  expect(keep.rationale).toContain("keep")

  const review = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.53,
    ...runs100,
  })
  expect(review.rationale).toContain("review")

  const insufficient = assessInstructionUsefulnessFromEvidence({
    baseline: { passed: 1, runs: 3 },
    with_instruction: { passed: 2, runs: 4 },
  })
  expect(insufficient.rationale).toContain("insufficient-data")
})
