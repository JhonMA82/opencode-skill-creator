# Instruction Quality

## Core principle

Every instruction must earn its context cost. An instruction that does not
measurably change behavior should be removed — no matter how well it reads.

The canonical failure mode is the "Write clean, maintainable code" rule: it
sounds like good advice, but if the agent already writes clean code
consistently without it, the phrase consumes tokens in every skill load
without adding signal. A skill is judged by the behavior it provokes, not
the intent it declares.

## Baseline vs with-instruction comparison

To decide whether one instruction earns its cost, run the same eval set twice
and compare pass rates:

1. **Baseline** — run the eval set without the instruction (the rest of the
   skill unchanged).
2. **With instruction** — run the identical set with the instruction present.
3. **Compare** — the delta between the two pass rates is the instruction's
   measured contribution.

Keep every other variable fixed; a single-instruction diff is what makes the
result interpretable. Instructions that cannot be isolated this way (or
whose behavior is not gradable) fall back to the human review loop instead.

## Sample-size-aware decision rules

The verdict is only trusted when both sides have enough runs — with small
samples the delta is indistinguishable from model noise. The tool computes
`sample_size = min(baseline_runs, with_runs)` and applies these rules in
order:

| Condition | Recommendation |
|---|---|
| `sample_size < 5` | `insufficient-data` — too few runs per side to separate signal from noise |
| `delta <= 0.02` | `remove` — the change does not justify the context cost |
| `delta >= 0.05` | `keep` — meaningful behavioral improvement |
| `0.02 < delta < 0.05` | `review` — run more samples or inspect transcript quality before deciding |
| `baseline >= 0.95` and `delta <= 0.03` | `remove` — no-op override: the agent already performs the behavior consistently without the instruction |

The no-op override is what catches the "Write clean, maintainable code" case:
a high baseline with no real gain means the instruction is decoration, even
when it has a tiny positive delta. A high-baseline instruction with a real
gain (`delta >= 0.05`) still recommends `keep`.

Example output: baseline 0.96 vs with-instruction 0.97 on 8 runs each gives
`delta +0.01`, `sample_size 8`, `recommendation: remove`.

## Thresholds are heuristics, not universal rules

The defaults (5 runs per side, 0.02 / 0.05 deltas, 0.95 / 0.03 no-op) are
documented starting points, tuned for cheap gradable outputs. Adjust them to
the skill's cost/benefit profile: a token-hungry discipline rule deserves a
higher keep-bar than a two-word retrieval hint. The tool reports a
human-readable `rationale` with every verdict so the decision stays
auditable.

## Integration into the improvement loop

Run the analysis during the improvement phase (see "Keep the prompt lean" in
the skill's iteration loop), when deciding whether to keep, cut, or rewrite a
specific instruction:

- **remove** — cut it, and let the regression suite confirm nothing regressed.
- **review** — add runs or read transcripts before deciding.
- **keep** — keep the leanest wording that still produces the measured delta.

Use it after pressure cases too: an instruction that only survives friendly
runs is a loophole, not a rule.

## Provenance

- **Instruction minimalism and the "Write clean, maintainable code"
  failure mode** — inspired by Matt Pocock's
  [writing-for-agents](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md)
  and its
  [SKILL-MECHANICS.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL-MECHANICS.md),
  which argue instructions should change agent behavior or be removed.
- The comparison design reuses this repo's existing baseline-run mechanics
  (paired `with_skill` / `without_skill` runs) so the analysis adds no new
  harness.

## Implementation in this repo

| Capability | Where |
|---|---|
| Instruction usefulness tool | `skill_instruction_usefulness` |
| Decision logic (sample-size aware, threshold-based) | `plugin/lib/instruction-usefulness.ts` — `assessInstructionUsefulness` |
| Schema and decision-rule documentation | `plugin/skill/references/schemas.md` — "instruction usefulness" |
