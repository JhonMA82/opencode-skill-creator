import { expect, test } from "bun:test"

import { assessInstructionUsefulness } from "../lib/instruction-usefulness"

const runs = { baseline_runs: 5, with_runs: 5 }

test("throws when pass rates are outside [0, 1]", () => {
  for (const baseline_pass_rate of [-0.01, 1.01]) {
    expect(() =>
      assessInstructionUsefulness({
        baseline_pass_rate,
        with_instruction_pass_rate: 0.5,
        ...runs,
      }),
    ).toThrow("pass rates must be between 0 and 1")
  }

  for (const with_instruction_pass_rate of [-0.01, 1.01]) {
    expect(() =>
      assessInstructionUsefulness({
        baseline_pass_rate: 0.5,
        with_instruction_pass_rate,
        ...runs,
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

test("insufficient-data when either side has fewer than 5 runs", () => {
  const result = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.9,
    baseline_runs: 3,
    with_runs: 4,
  })

  expect(result.recommendation).toBe("insufficient-data")
  expect(result.sample_size).toBe(3)
  expect(result.rationale).toContain("insufficient-data")
})

test("remove when delta is <= 0.02", () => {
  const small = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.51,
    ...runs,
  })
  expect(small.recommendation).toBe("remove")
  expect(small.delta).toBe(0.01)

  const boundary = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.52,
    ...runs,
  })
  expect(boundary.recommendation).toBe("remove")
  expect(boundary.delta).toBe(0.02)
})

test("keep when delta is >= 0.05", () => {
  const boundary = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.55,
    ...runs,
  })
  expect(boundary.recommendation).toBe("keep")
  expect(boundary.delta).toBe(0.05)

  const large = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.6,
    ...runs,
  })
  expect(large.recommendation).toBe("keep")
  expect(large.delta).toBe(0.1)
})

test("review when delta is between 0.02 and 0.05", () => {
  const low = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.53,
    ...runs,
  })
  expect(low.recommendation).toBe("review")
  expect(low.delta).toBe(0.03)

  const high = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.54,
    ...runs,
  })
  expect(high.recommendation).toBe("review")
  expect(high.delta).toBe(0.04)
})

test("no-op override: high baseline with negligible delta recommends remove with consistent-behavior rationale", () => {
  const result = assessInstructionUsefulness({
    baseline_pass_rate: 0.97,
    with_instruction_pass_rate: 0.99,
    ...runs,
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
    ...runs,
  })
  expect(review.delta).toBe(0.04)
  expect(review.recommendation).toBe("review")

  const keep = assessInstructionUsefulness({
    baseline_pass_rate: 0.95,
    with_instruction_pass_rate: 1,
    ...runs,
  })
  expect(keep.delta).toBe(0.05)
  expect(keep.recommendation).toBe("keep")
})

test("instruction_text is echoed in the result", () => {
  const result = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.51,
    ...runs,
    instruction_text: "Write clean, maintainable code",
  })

  expect(result.instruction_text).toBe("Write clean, maintainable code")
  expect(result.rationale).toContain("Write clean, maintainable code")
})

test("delta is rounded to 4 decimals", () => {
  const result = assessInstructionUsefulness({
    baseline_pass_rate: 0.3,
    with_instruction_pass_rate: 0.63333,
    ...runs,
  })

  expect(result.delta).toBe(0.3333)
})

test("rationale strings contain the recommendation keyword", () => {
  const remove = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.51,
    ...runs,
  })
  expect(remove.rationale).toContain("remove")

  const keep = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.6,
    ...runs,
  })
  expect(keep.rationale).toContain("keep")

  const review = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.53,
    ...runs,
  })
  expect(review.rationale).toContain("review")

  const insufficient = assessInstructionUsefulness({
    baseline_pass_rate: 0.5,
    with_instruction_pass_rate: 0.6,
    baseline_runs: 2,
    with_runs: 5,
  })
  expect(insufficient.rationale).toContain("insufficient-data")
})
