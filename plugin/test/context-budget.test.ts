import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

import { afterEach, expect, test } from "bun:test"

import {
  countExamples,
  countWords,
  defaultBudgets,
  estimateTokens,
  findDuplicateSections,
  lintSkillContext,
} from "../lib/context-budget"

const createdDirs: string[] = []

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function makeSkillDir(
  options: {
    frontmatter?: string
    body?: string
    references?: Record<string, string>
    emptyScripts?: boolean
    emptyAssets?: boolean
    noSkillMd?: boolean
    noFrontmatter?: boolean
  } = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), "skill-creator-budget-"))
  createdDirs.push(dir)

  if (!options.noSkillMd) {
    if (options.noFrontmatter) {
      writeFileSync(join(dir, "SKILL.md"), "# No frontmatter here\n")
    } else {
      const frontmatter =
        options.frontmatter ?? 'name: test-skill\ndescription: "A test skill"\n'
      const body = options.body ?? "# Test Skill\n\nSome instructions.\n"
      writeFileSync(join(dir, "SKILL.md"), `---\n${frontmatter}---\n\n${body}`)
    }
  }

  if (options.references) {
    mkdirSync(join(dir, "references"), { recursive: true })
    for (const [name, content] of Object.entries(options.references)) {
      const refPath = join(dir, "references", name)
      mkdirSync(join(refPath, ".."), { recursive: true })
      writeFileSync(refPath, content)
    }
  }

  if (options.emptyScripts) mkdirSync(join(dir, "scripts"), { recursive: true })
  if (options.emptyAssets) mkdirSync(join(dir, "assets"), { recursive: true })

  return dir
}

/** n whitespace-separated single tokens, e.g. "w0 w1 w2". */
function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `w${i}`).join(" ")
}

const CHECK_NAMES = [
  "skill_md_exists",
  "frontmatter_valid",
  "skill_md_words",
  "skill_md_tokens",
  "references_count",
  "reference_depth",
  "largest_reference",
  "duplicate_sections",
  "examples_count",
  "progressive_disclosure",
]

test("estimateTokens: 0 words -> 0; words * 1.33 rounded up", () => {
  expect(estimateTokens("")).toBe(0)
  expect(estimateTokens("   \n\t ")).toBe(0)
  expect(estimateTokens(words(100))).toBe(133)
  expect(estimateTokens("one two three")).toBe(4)
})

test("countWords: empty, whitespace collapse, non-empty tokens", () => {
  expect(countWords("")).toBe(0)
  expect(countWords("   \n\t  ")).toBe(0)
  expect(countWords("one two   three\n\nfour")).toBe(4)
  expect(countWords("word")).toBe(1)
})

test("findDuplicateSections: no duplicates", () => {
  expect(findDuplicateSections("## One\n## Two\n### Three")).toEqual([])
})

test("findDuplicateSections: duplicate headings found once, case-insensitive", () => {
  expect(findDuplicateSections("## Setup\n## setup\n### SETUP\n## Other")).toEqual([
    "setup",
  ])
})

test("findDuplicateSections: frontmatter is stripped", () => {
  const markdown = `---
name: test-skill
description: |
  Reference guide.
## Install
---

## Install
`
  expect(findDuplicateSections(markdown)).toEqual([])
})

test("findDuplicateSections: ignores non-heading lines", () => {
  const markdown = "## Topic\na line with # Topic inside\n## Topic\n"
  expect(findDuplicateSections(markdown)).toEqual(["topic"])
})

test("countExamples: counts Example/Examples headings, ignores others", () => {
  const markdown = [
    "## Examples",
    "Some text",
    "**Example 1:**",
    "Input: hello",
    "Output: hi",
    "## Install",
    "### Worked Example",
    "## Usage",
  ].join("\n")
  expect(countExamples(markdown)).toBe(3)
  expect(countExamples("## Install\n## Usage\nplain example text\n")).toBe(0)
})

test("defaultBudgets returns the exact defaults", () => {
  expect(defaultBudgets()).toEqual({
    skill_md: { warning_words: 500, error_words: null },
    frequent_skill: { warning_words: 250 },
    reference_depth: { warning: 2 },
  })
})

test("lintSkillContext: missing SKILL.md returns a single error check", () => {
  const dir = makeSkillDir({ noSkillMd: true })
  const result = lintSkillContext(dir)

  expect(result.checks).toHaveLength(1)
  expect(result.checks[0]).toEqual({
    check: "skill_md_exists",
    level: "error",
    message: "SKILL.md not found",
  })
  expect(result.summary).toEqual({ ok: 0, warning: 0, error: 1 })
})

test("lintSkillContext: valid minimal skill has all checks, no errors", () => {
  const dir = makeSkillDir()
  const result = lintSkillContext(dir)

  expect(result.checks.map((check) => check.check)).toEqual(CHECK_NAMES)
  expect(result.checks.every((check) => check.level === "ok")).toBe(true)
  expect(result.summary).toEqual({ ok: 10, warning: 0, error: 0 })
  expect(
    result.checks.find((check) => check.check === "skill_md_words")?.level,
  ).toBe("ok")
})

test("lintSkillContext: oversized SKILL.md body warns and suggests references/", () => {
  const dir = makeSkillDir({ body: words(600) })
  const result = lintSkillContext(dir)

  const check = result.checks.find((c) => c.check === "skill_md_words")
  expect(check?.level).toBe("warning")
  expect(check?.message).toContain("references/")
  expect(result.summary.warning).toBeGreaterThanOrEqual(1)
})

test("lintSkillContext: configured error_words produces an error level", () => {
  const dir = makeSkillDir({ body: words(600) })
  const result = lintSkillContext(dir, { skill_md: { error_words: 400 } })

  const check = result.checks.find((c) => c.check === "skill_md_words")
  expect(check?.level).toBe("error")
  expect(result.summary.error).toBeGreaterThanOrEqual(1)
})

test("lintSkillContext: explicit error_words null never errors", () => {
  const dir = makeSkillDir({ body: words(600) })
  const result = lintSkillContext(dir, { skill_md: { error_words: null } })

  const check = result.checks.find((c) => c.check === "skill_md_words")
  expect(check?.level).toBe("warning")
})

test("lintSkillContext: frequent metadata lowers the warning threshold to 250", () => {
  const frequent = makeSkillDir({
    frontmatter:
      'name: test-skill\ndescription: "A test skill"\nmetadata:\n  frequent: true\n',
    body: words(300),
  })
  const frequentCheck = lintSkillContext(frequent).checks.find(
    (c) => c.check === "skill_md_words",
  )
  expect(frequentCheck?.level).toBe("warning")

  const normal = makeSkillDir({ body: words(300) })
  const normalCheck = lintSkillContext(normal).checks.find(
    (c) => c.check === "skill_md_words",
  )
  expect(normalCheck?.level).toBe("ok")
})

test("lintSkillContext: load: always metadata also triggers the frequent budget", () => {
  const dir = makeSkillDir({
    frontmatter:
      'name: test-skill\ndescription: "A test skill"\nmetadata:\n  load: always\n',
    body: words(300),
  })
  const check = lintSkillContext(dir).checks.find((c) => c.check === "skill_md_words")
  expect(check?.level).toBe("warning")
})

test("lintSkillContext: deep references warn when depth exceeds 2", () => {
  const deep = makeSkillDir({
    references: {
      "a.md": "# A\n",
      "sub/b.md": "# B\n",
      "sub/sub/c.md": "# C\n",
    },
  })
  const deepCheck = lintSkillContext(deep).checks.find(
    (c) => c.check === "reference_depth",
  )
  expect(deepCheck?.level).toBe("warning")

  const shallow = makeSkillDir({
    references: { "a.md": "# A\n", "sub/b.md": "# B\n" },
  })
  const shallowCheck = lintSkillContext(shallow).checks.find(
    (c) => c.check === "reference_depth",
  )
  expect(shallowCheck?.level).toBe("ok")
})

test("lintSkillContext: large reference file warns on largest_reference", () => {
  const big = makeSkillDir({ references: { "big.md": words(1600) } })
  const bigCheck = lintSkillContext(big).checks.find(
    (c) => c.check === "largest_reference",
  )
  expect(bigCheck?.level).toBe("warning")
  expect(bigCheck?.message).toContain("big.md")

  const small = makeSkillDir({ references: { "small.md": words(100) } })
  const smallCheck = lintSkillContext(small).checks.find(
    (c) => c.check === "largest_reference",
  )
  expect(smallCheck?.level).toBe("ok")
})

test("lintSkillContext: duplicate headings warn and list the duplicates", () => {
  const dir = makeSkillDir({
    body: "## Install\nInstructions here.\n## install\nMore instructions.\n## Setup\n",
  })
  const result = lintSkillContext(dir)

  const check = result.checks.find((c) => c.check === "duplicate_sections")
  expect(check?.level).toBe("warning")
  expect(check?.message).toContain("install")
})

test("lintSkillContext: more than 5 reference files warns on references_count", () => {
  const references: Record<string, string> = {}
  for (let i = 0; i < 6; i += 1) references[`ref${i}.md`] = "# R\n"
  const dir = makeSkillDir({ references })

  const check = lintSkillContext(dir).checks.find((c) => c.check === "references_count")
  expect(check?.level).toBe("warning")
})

test("lintSkillContext: skill_md_tokens is informational and reports the estimate", () => {
  const dir = makeSkillDir({ body: words(100) })
  const result = lintSkillContext(dir)

  const check = result.checks.find((c) => c.check === "skill_md_tokens")
  expect(check?.level).toBe("ok")
  expect(check?.message).toContain("133")
})

test("lintSkillContext: progressive disclosure suggests references for long bodies", () => {
  const dir = makeSkillDir({ body: words(600) })
  const result = lintSkillContext(dir)

  const check = result.checks.find((c) => c.check === "progressive_disclosure")
  expect(check?.level).toBe("warning")
  expect(check?.message).toContain("references/")
})

test("lintSkillContext: empty scripts/ dir gets an info-level suggestion", () => {
  const dir = makeSkillDir({ emptyScripts: true })
  const result = lintSkillContext(dir)

  const check = result.checks.find((c) => c.check === "progressive_disclosure")
  expect(check?.level).toBe("ok")
  expect(check?.message).toContain("empty")
})

test("lintSkillContext: missing frontmatter errors on frontmatter_valid", () => {
  const dir = makeSkillDir({ noFrontmatter: true })
  const result = lintSkillContext(dir)

  const check = result.checks.find((c) => c.check === "frontmatter_valid")
  expect(check?.level).toBe("error")
  expect(result.summary.error).toBeGreaterThanOrEqual(1)
})

test("lintSkillContext: frontmatter missing description key errors", () => {
  const dir = makeSkillDir({ frontmatter: "name: test-skill\n" })
  const result = lintSkillContext(dir)

  const check = result.checks.find((c) => c.check === "frontmatter_valid")
  expect(check?.level).toBe("error")
})
