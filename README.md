<div align="center">

# opencode-skill-creator

**Create, test, and optimize OpenCode skills — from first draft to production-grade.**

[![npm](https://img.shields.io/npm/v/opencode-skill-creator)](https://www.npmjs.com/package/opencode-skill-creator)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/antongulin/opencode-skill-creator?style=social)](https://github.com/antongulin/opencode-skill-creator/stargazers)

A **skill + plugin** for [OpenCode](https://opencode.ai) that brings eval-driven development to AI agent skills — based on Anthropic's official [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) for Claude Code, ported to TypeScript and adapted for OpenCode's plugin architecture.

[Install](#install) · [What it does](#what-it-does) · [Plugin tools](#plugin-tools) · [Usage](#usage) · [Architecture](#architecture)

</div>

---

## Why this exists

Creating AI agent skills is guesswork. You write a skill, test it manually, maybe tweak the description, and hope it triggers correctly. There's no systematic way to measure whether a skill works or to track improvements across iterations.

opencode-skill-creator fixes this with **eval-driven development for skills**:

- **Test** — Auto-generate eval test sets and measure trigger accuracy
- **Optimize** — Iteratively improve skill descriptions with a train/test split
- **Benchmark** — Quantitative comparison across iterations with variance analysis
- **Review** — Built-in visual eval viewer for human-in-the-loop feedback
- **Install** — Deploy validated skills to project or global config

Based on Anthropic's proven methodology. Free for everyone. Works with any model OpenCode supports.

## Install

Package: https://www.npmjs.com/package/opencode-skill-creator

### Pick your option

| If you are... | Use this |
|---|---|
| New to OpenCode / non-developer | **Option A (Recommended)** |
| Already using other plugins | **Option B** |
| Setting up all projects on your computer | **Option C (Global config)** |
| Setting up only one project | **Option D (Project config)** |
| Cannot use npm / offline environment | **Option E (Manual install)** |

### Option A (Recommended): easiest setup for most users

Run one command (global install, recommended):

```bash
npx opencode-skill-creator install --global
```

Note: `opencode-skill-creator` on npm is the upstream package, so `npx` installs upstream, not this fork. Fork users should install from this fork's repository — see [Fork identity and installation](#fork-identity-and-installation).

Optional checks:

```bash
npx opencode-skill-creator --version
npx opencode-skill-creator --help
npx opencode-skill-creator --about
```

What this command does:

1. Updates existing `~/.config/opencode/opencode.jsonc` when present; otherwise creates/updates `opencode.json`
2. Adds `"opencode-skill-creator"` to the `plugin` array
3. Leaves your existing plugins untouched

Then:

4. Restart OpenCode
5. Ask OpenCode: `Create a skill that helps with Docker compose files`

That's it.

Manual equivalent for the same result:

1. Open (or create) `~/.config/opencode/opencode.jsonc` or `~/.config/opencode/opencode.json`
2. Paste this:

```json
{
  "plugin": ["opencode-skill-creator"]
}
```

3. Restart OpenCode.

If you want project-only install instead, use:

```bash
npx opencode-skill-creator install --project
```

### Option B: you already have plugins

If your file already has plugins, append this package to the list:

```json
{
  "plugin": [
    "your-existing-plugin",
    "opencode-skill-creator"
  ]
}
```

Do not remove your existing plugins.

### Option C: global config (works in all projects)

Use global config when you want this plugin available everywhere.

Command version:

```bash
npx opencode-skill-creator install --global
```

Note: `opencode-skill-creator` on npm is the upstream package, so `npx` installs upstream, not this fork. Fork users should install from this fork's repository — see [Fork identity and installation](#fork-identity-and-installation).

1. Open (or create) `~/.config/opencode/opencode.jsonc` or `~/.config/opencode/opencode.json`
2. Add:

```json
{
  "plugin": ["opencode-skill-creator"]
}
```

3. Restart OpenCode.

### Option D: project config (only one project)

Use project config when you want this plugin only for one repo.

Command version:

```bash
npx opencode-skill-creator install --project
```

1. Open (or create) `opencode.jsonc` or `opencode.json` in that project root
2. Add:

```json
{
  "plugin": ["opencode-skill-creator"]
}
```

3. Restart OpenCode in that project.

### Option E: manual install (no npm)

```bash
git clone https://github.com/JhonMA82/opencode-skill-creator.git
cd opencode-skill-creator

# Install the skill (global)
cp -r opencode-skill-creator/ ~/.config/opencode/skills/opencode-skill-creator/

# Install the plugin (global)
cp -r plugin/ ~/.config/opencode/plugins/skill-creator/
```

Then create `~/.config/opencode/package.json` if needed:

```json
{
  "dependencies": {
    "@opencode-ai/plugin": ">=1.0.0"
  }
}
```

### What happens after install

After you add `opencode-skill-creator` and restart OpenCode:

1. OpenCode installs the plugin from npm automatically.
2. The npm package loads compiled JavaScript from `dist/skill-creator.js`.
3. On first plugin startup, it auto-copies skill files to `~/.config/opencode/skills/opencode-skill-creator/`.
4. Restart OpenCode after changing config because plugin config is loaded at startup.

### Verify install

Check that the skill file exists:

```bash
ls ~/.config/opencode/skills/opencode-skill-creator/SKILL.md
```

Then ask OpenCode:

```text
Use opencode-skill-creator to create a skill that helps with API documentation.
```

You should see it use the opencode-skill-creator workflow/tools.

### Migration from the old `skill-creator` folder

Earlier versions installed the bundled skill as the generic `skill-creator` skill. That could conflict with other plugins, including Superpowers, that also provide a skill with the same name.

Current versions install the bundled skill as `opencode-skill-creator` instead. On startup, if the plugin finds an old plugin-owned folder at `~/.config/opencode/skills/skill-creator/`, it moves that folder to an inactive backup such as:

```text
~/.config/opencode/skills/skill-creator.opencode-skill-creator-backup-YYYYMMDDTHHMMSS/
```

The backup preserves user files and renames `SKILL.md` to `SKILL.md.backup` so OpenCode will not keep loading the old generic skill. If the old `skill-creator` folder does not contain the plugin's `.opencode-skill-creator-version` marker, the plugin leaves it untouched because it may belong to another plugin or a manually installed skill.

### Troubleshooting

- `I don't have opencode.jsonc/opencode.json`: create one in project root (or use global config path).
- `Nothing changed after edit`: fully restart OpenCode.
- `I already had plugins`: keep them; just add `opencode-skill-creator` to the same array.
- `I want a clean reinstall`: delete `~/.config/opencode/skills/opencode-skill-creator/` and restart OpenCode.
- `I still see another skill-creator skill`: if `~/.config/opencode/skills/skill-creator/` has no `.opencode-skill-creator-version` marker, it is not managed by this plugin and must be reviewed separately.
- `npx command failed`: run `npx opencode-skill-creator --help` and then use `install` or `install --global`.

### For LLMs / automation (compact)

```json
{ "plugin": ["opencode-skill-creator"] }
```

## What it does

When loaded, this skill guides OpenCode through the full skill development lifecycle:

1. **Analyze** the user's request and determine what kind of skill to build
2. **Create** a well-structured skill with proper frontmatter, SKILL.md, and supporting files
3. **Generate** an eval set of test queries (should-trigger and should-not-trigger)
4. **Evaluate** the skill's description by testing whether it triggers correctly
5. **Optimize** the description through iterative improvement loops
6. **Benchmark** skill performance with variance analysis
7. **Install** the skill to the project or global OpenCode skills directory
8. **Audit** individual instructions with a usefulness analysis (instruction-minimalism check) so each one earns its context cost

It also supports **behavioral TDD**: skill-type classification (discipline/technique/pattern/reference/workflow) with per-type baseline policy, pressure cases that test the skill under adversarial conditions, rationalization capture from failed runs, and a permanent regression suite that reruns every real behavioral failure on each iteration.
Throughout the loop, a context-budget lint (`skill_context_lint`) keeps SKILL.md and its references lean so skills load fast and stay cheap in tokens.

## Plugin tools

The plugin registers these custom tools that OpenCode can call:

| Tool | Purpose |
|------|---------|
| `skill_validate` | Validate SKILL.md structure and frontmatter |
| `skill_parse` | Parse SKILL.md and extract name/description |
| `skill_context_lint` | Lint context/token budget (SKILL.md size, reference depth, duplicates) |
| `skill_eval` | Test trigger accuracy for eval queries |
| `skill_improve_description` | LLM-powered description improvement |
| `skill_optimize_loop` | Full eval→improve optimization loop |
| `skill_aggregate_benchmark` | Aggregate grading results into statistics |
| `skill_generate_report` | Generate HTML optimization report |
| `skill_serve_review` | Start the eval review viewer (HTTP server) |
| `skill_stop_review` | Stop a running review server |
| `skill_export_static_review` | Generate standalone HTML review file |
| `skill_validate_cases` | Validate behavioral case sets and report the baseline policy |
| `skill_collect_rationalizations` | Collect observable rationalization records from grading.json files |
| `skill_regression_suite` | Manage the regression suite (add/list/resolve cases) |
| `skill_instruction_usefulness` | Assess whether an instruction earns its context cost |

### Description optimization loop

The most impactful feature for skill quality. It treats skill descriptions as a search problem:

1. Generates 20 test queries (should-trigger + should-not-trigger)
2. Splits into 60% train / 40% test
3. Runs each query 3 times for statistical reliability
4. Analyzes failure patterns
5. LLM proposes improved descriptions
6. Re-evaluates on both train AND test sets
7. Selects the best description by test score (prevents overfitting)
8. Repeats up to 5 iterations

### Review workflow guard (strict by default)

The review launch tools enforce paired comparison data by default:

- `skill_serve_review` and `skill_export_static_review` require each `eval-*` directory to include:
  - `with_skill`
  - baseline (`without_skill` or `old_skill`)
- If pairs are missing, the tools fail fast with a clear list of missing items.
- Override only when intentionally reviewing partial data by passing `allowPartial: true`.
- If `benchmarkPath` is omitted, the tools auto-generate `benchmark.json` and `benchmark.md` in the workspace.

### Skill draft staging (recommended)

When creating new skills, use a staging path in the system temp directory outside your current repository:

- Unix/macOS draft skill path: `/tmp/opencode-skills/<skill-name>/` (or `$TMPDIR/opencode-skills/<skill-name>/`)
- Unix/macOS eval workspace path: `/tmp/opencode-skills/<skill-name>-workspace/`
- Windows draft/eval paths: `%TEMP%\opencode-skills\<skill-name>\` and `%TEMP%\opencode-skills\<skill-name>-workspace\`
- Install only the final validated skill to:
  - project: `.opencode/skills/<skill-name>/`
  - global: `~/.config/opencode/skills/<skill-name>/`

This keeps plugin/source repositories clean while preserving the full eval loop.

## Usage

Once installed, OpenCode will automatically detect the skill when you ask it to create or improve a skill. For example:

- "Create a skill that helps with Docker compose files"
- "Build me a skill for generating API documentation"
- "Help me make a skill that assists with database migrations"
- "Optimize the description of my existing skill"

OpenCode will load the opencode-skill-creator instructions and use the plugin tools to walk through the full workflow.

## Examples

The fastest way to see the workflow end to end: start with the [Docker Compose helper example](examples/docker-compose-helper/). It includes a small complete skill, a trigger eval set in the exact `skill_eval` JSON format, and copy-pasteable prompts for `skill_eval`, `skill_optimize_loop`, and benchmark review.

Use it after install to see how description evals work before creating your own skill.

## Architecture

This project has two components:

| Component | What it is |
|-----------|-----------|
| **Skill** | Markdown instructions (SKILL.md + agents + templates) that tell the agent how to create, evaluate, and improve skills |
| **Plugin** | TypeScript module that registers custom tools for validation, eval, benchmarking, and review |

The skill provides the workflow knowledge; the plugin provides the executable tools the agent calls during that workflow.

On first startup, the plugin automatically copies the bundled skill files to `~/.config/opencode/skills/opencode-skill-creator/`. If you need to reinstall the skill (e.g., after an update), delete that directory and restart OpenCode.

## Project structure

```
opencode-skill-creator/
├── README.md
├── LICENSE                            # Apache 2.0
├── opencode-skill-creator/            # The SKILL
│   ├── SKILL.md                       # Main skill instructions
│   ├── agents/
│   │   ├── grader.md                  # Assertion evaluation
│   │   ├── analyzer.md                # Benchmark analysis
│   │   └── comparator.md              # Blind A/B comparison
│   ├── references/
│   │   └── schemas.md                 # JSON schema definitions
│   └── templates/
│       └── eval-review.html           # Eval set review/edit UI
└── plugin/                            # The PLUGIN (npm: opencode-skill-creator)
    ├── package.json                   # npm package metadata
    ├── skill-creator.ts               # Entry point — registers all tools
    ├── skill/                         # Bundled copy of skill (auto-installed)
    ├── lib/
    │   ├── utils.ts                   # SKILL.md frontmatter parsing
    │   ├── validate.ts                # Skill structure validation
    │   ├── context-budget.ts          # Context/token budget lint
    │   ├── run-eval.ts                # Trigger evaluation via opencode run
    │   ├── improve-description.ts     # LLM-powered description improvement
    │   ├── run-loop.ts                # Eval→improve optimization loop
    │   ├── aggregate.ts               # Benchmark aggregation
    │   ├── report.ts                  # HTML report generation
    │   └── review-server.ts           # Eval review HTTP server
    └── templates/
        └── viewer.html                # Eval review viewer UI
```

## Differences from the Anthropic original

| Area | Anthropic (Claude Code) | This repo (OpenCode) |
|------|------------------------|---------------------|
| CLI invocation | `claude -p "prompt"` | `opencode run "prompt"` |
| Skill location | `.claude/commands/` | `.opencode/skills/` |
| Automation scripts | Python (`scripts/*.py`) | TypeScript plugin (`plugin/lib/*.ts`) |
| Script execution | `python -m scripts.run_loop` | `skill_optimize_loop` tool call |
| Eval viewer | `python generate_review.py` | `skill_serve_review` tool call |
| Benchmarking | `python aggregate_benchmark.py` | `skill_aggregate_benchmark` tool call |
| Dependencies | Python 3.11+, pyyaml | Bun (via OpenCode), @opencode-ai/plugin |
| Packaging | `.skill` zip files | npm package + skill directory |
| Subagents | Built-in subagent concept | Task tool with `general`/`explore` types |

## Fork evolution (JhonMA82)

This fork keeps [antongulin/opencode-skill-creator](https://github.com/antongulin/opencode-skill-creator) as its technical base and adds **evidence-driven Agent Skill authoring** capabilities per the evolution proposal ([`opencode-skill-creator-propuesta-evolucion.md`](opencode-skill-creator-propuesta-evolucion.md)): behavioral TDD, context-budget linting, and instruction-usefulness analysis. Upstream synchronization is preserved and unchanged:

```bash
git fetch upstream && git rebase upstream/main
```

### Provenance matrix

Every added capability carries its provenance, so it stays clear what is conserved from upstream and what is inspired by other projects.

| Capability | Primary source | Integration |
|---|---|---|
| OpenCode plugin/tooling | Anton | Conserved |
| Skill creation pipeline | Anton + Anthropic | Extended, not replaced |
| Baseline eval | Anthropic / Anton | Conserved and reinforced |
| Behavioral TDD | Superpowers | Added |
| Pressure scenarios | Superpowers | Added |
| Rationalization testing | Superpowers | Added |
| Trigger optimization | Anton + Anthropic | Conserved |
| Progressive disclosure | Agent Skills + OpenAI | Added lint |
| Token/context discipline | Microsoft | Added lint |
| Instruction usefulness | Matt Pocock | Added (experimental) |
| Skill specification | Agent Skills | Compatibility mandatory |
| Workflow composition | Comet | Optional adapter, deferred until a real need |
| Multi-platform packaging | Francy | Postponed |
| Simple cross-agent authoring | Gentleman | Secondary reference only |

### Fork changes

- **Five new plugin tools**: `skill_validate_cases` (behavioral case validation + baseline policy), `skill_collect_rationalizations` (observable failure explanations), `skill_regression_suite` (permanent regression cases), `skill_context_lint` (context/token budget lint), and `skill_instruction_usefulness` (does an instruction earn its context cost).
- **Methodology docs**: the authoring methodology is documented in [`docs/methodologies/`](docs/methodologies/) — [behavioral-tdd.md](docs/methodologies/behavioral-tdd.md), [evaluation-strategy.md](docs/methodologies/evaluation-strategy.md), [progressive-disclosure.md](docs/methodologies/progressive-disclosure.md), and [instruction-quality.md](docs/methodologies/instruction-quality.md).
- **Upstream-friendly Linux fix**: the best-effort browser open in the review server now handles the async `error` event, so headless Linux environments (where `open` does not exist) no longer crash the server with an `uncaughtException` — a minimal change that does not affect macOS behavior and could be contributed upstream.

### Development

```bash
cd plugin
npm install                            # dependencies (npm is the package manager)
bun test --isolate test/*.test.ts      # TypeScript suite (behavioral, context, usefulness, ...)
npm run build                          # regenerate dist/ from sources
npm test                               # package/CLI tests against the built dist
git diff --exit-code -- plugin/dist    # dist consistency check (from the repo root; also enforced by CI)
```

CI (`.github/workflows/ci.yml`) runs the TypeScript suite, the build, the package tests, and the dist consistency check on every push and pull request. For upstream synchronization see the command above (`git fetch upstream && git rebase upstream/main`).

## Fork identity and installation

This repository is a maintained fork of [antongulin/opencode-skill-creator](https://github.com/antongulin/opencode-skill-creator) (fork owner: JhonMA82). The public npm package `opencode-skill-creator` belongs to the upstream project and tracks its releases — `npx opencode-skill-creator` and `npm i -g opencode-skill-creator` install upstream, not this fork's extensions.

To install this fork's plugin:

1. Clone the fork: `git clone https://github.com/JhonMA82/opencode-skill-creator.git`
2. Install the plugin from the local clone — [plugin/README.md](plugin/README.md) documents the manual install (its clone URL points at upstream; use the fork URL above). In short, copy or symlink the `plugin/` directory into OpenCode's plugins directory, e.g. `cp -r plugin/ ~/.config/opencode/plugins/skill-creator/`
3. Restart OpenCode.

The bundled skill auto-installs on first plugin startup (it is copied to `~/.config/opencode/skills/opencode-skill-creator/`), so no separate skill install is needed.

Upstream behavior to know: the plugin periodically checks `https://registry.npmjs.org/opencode-skill-creator/latest` and refreshes its cached plugin files when upstream publishes a newer version. Fork users who want to stay on this fork's code can disable that check with `OPENCODE_SKILL_CREATOR_AUTO_UPDATE=0`.

Upstream remains the canonical project — the plugin and skill machinery are upstream work, preserved unchanged in this fork.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

Based on [anthropics/skills](https://github.com/anthropics/skills) by Anthropic.
