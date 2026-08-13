# Progressive Disclosure

## Core principle

SKILL.md holds only what must be in context whenever the skill triggers:
essential behavior, triggers, critical decisions, the common workflow, and
necessary guardrails. Everything else is a bundled resource loaded on demand:

- Long documentation → `references/`
- Deterministic work → `scripts/`
- Templates and artifacts → `assets/`

The skill loads cheap because SKILL.md is small; it stays complete because
the full material is one pointer away.

## Three-level loading model

| Level | What | Cost |
|---|---|---|
| 1. Metadata | `name` + `description` frontmatter (triggers) | Always in context (~100 words) |
| 2. SKILL.md body | Essential behavior, workflow, guardrails | In context whenever the skill triggers (<500 words ideal) |
| 3. Bundled resources | `references/`, `scripts/`, `assets/` | Loaded on demand; scripts can execute without loading |

Each level must tell the model where to go next: SKILL.md points to the
reference to read for a task, and large references carry a table of contents.

## Placement decisions

| Content | Goes to | Why |
|---|---|---|
| Essential behavior, triggers, critical decisions, common workflow, necessary guardrails | SKILL.md | Must be present the moment the skill triggers |
| Extensive docs, API docs, rare edge cases, large tables, consult material | `references/` | Needed only for specific tasks |
| Deterministic transformations, validation, parsing, repetitive generation | `scripts/` | Code beats prose: no model reasoning needed, reusable, exact |
| Templates, artifacts to copy, base output files | `assets/` | Copied or reused as-is |
| Tutorials, background prose, narrative | nowhere | Instructions, not explanations |

Prefer a script whenever the operation is deterministic — it is faster, more
reliable, and never paraphrased by the model.

## Reference depth and size guidance

- **Depth** — keep nesting under `references/` flat: top-level files are
  depth 1, and depth 3+ (the budget is 2) buries content and duplicates
  context when multiple files load.
- **Size** — keep the largest reference under ~1500 words; split bigger files
  and add a table of contents for anything over 300 lines.
- **Count** — more than ~5 reference files is a signal to consolidate.
- **Domain organization** — when a skill spans variants (e.g. cloud providers),
  organize by variant so the model reads only the relevant file:

```text
cloud-deploy/
├── SKILL.md   (workflow + selection)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

## Duplicate-section avoidance

A rule belongs in exactly one place. Duplicated sections — same heading in
SKILL.md, or the same guidance in a reference that is already in the body —
consume context twice and drift apart when edited. The lint flags duplicate
ATX headings (frontmatter stripped, normalized case) and lists up to 3, so
duplication is caught mechanically instead of by memory.

## Context-budget lint

`skill_context_lint` reports checks (never hard errors) and suggests moving
long sections into `references/` when SKILL.md exceeds its budget with fewer
than 2 reference files. Budgets are configurable per call:

| Budget | Default | Meaning |
|---|---|---|
| `skill_md.warning_words` | 500 | SKILL.md body word count above which a warning is raised |
| `skill_md.error_words` | null | Optional hard-error threshold; no error while null |
| `frequent_skill.warning_words` | 250 | Warning threshold for frequently loaded skills (`frequent: true` / `load: always`) |
| `reference_depth.warning` | 2 | Max directory nesting under `references/` |
| largest reference | 1500 words | Fixed warning threshold for the largest reference |
| references count | 5 files | Fixed warning threshold |

Checked metrics: SKILL.md presence, frontmatter validity, body words and
estimated tokens (`ceil(words × 1.33)`, heuristic), references count, nesting
depth, largest reference, duplicate section headings, examples count
(informational), and the progressive-disclosure suggestion.

Warnings are advisory: they signal "trim or restructure", not "block".

## Provenance

- **Three-level loading and resource structure** — inspired by the
  [Agent Skills specification](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)
  and the
  [OpenAI skill-creator](https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md).
- **Token/context budget lint** — inspired by the
  [Microsoft skill-creator](https://github.com/microsoft/skills/blob/main/.github/skills/skill-creator/SKILL.md)
  (budgets as warnings, not rigid rules).
- Compatibility note: folders the Agent Skills specification treats as
  optional are never made mandatory here.

## Implementation in this repo

| Capability | Where |
|---|---|
| Context-budget lint tool | `skill_context_lint` |
| Lint logic (words, tokens, depth, duplicates, progressive disclosure) | `plugin/lib/context-budget.ts` — `lintSkillContext`, `defaultBudgets`, `findDuplicateSections` |
| Schema and budget documentation | `plugin/skill/references/schemas.md` — "context budget lint" |
