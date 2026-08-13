/**
 * Context/token budget lint for skills.
 *
 * Estimates how lean a skill is: SKILL.md body size in words and tokens,
 * references count and nesting depth, largest reference, duplicate section
 * headings, examples count, and progressive-disclosure suggestions.
 *
 * Budgets are configurable per call and warnings are advisory — this module
 * reports, it never hard-fails a skill.
 */

import { type Dirent, existsSync, readdirSync, readFileSync } from "fs"
import { join, relative, sep } from "path"

export interface BudgetLimits {
  skill_md?: { warning_words?: number; error_words?: number | null }
  frequent_skill?: { warning_words?: number }
  reference_depth?: { warning?: number }
}

export interface BudgetCheck {
  /** Machine-readable id, e.g. "skill_md_words". */
  check: string
  level: "ok" | "warning" | "error"
  message: string
}

export interface LintResult {
  checks: BudgetCheck[]
  summary: { ok: number; warning: number; error: number }
}

const DEFAULT_SKILL_MD_WARNING_WORDS = 500
const DEFAULT_FREQUENT_SKILL_WARNING_WORDS = 250
const DEFAULT_REFERENCE_DEPTH_WARNING = 2
const LARGEST_REFERENCE_WARNING_WORDS = 1500
const MAX_REFERENCE_FILES = 5
const MAX_DUPLICATES_LISTED = 3

/** Frontmatter block — same approach as lib/validate.ts. */
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/

/**
 * Deterministic token-count heuristic: ceil(words * 1.33).
 *
 * Computed as ceil(words * 133 / 100) so integer word counts can never hit
 * float-rounding edges. This is an estimate, not a model-accurate token
 * count — real tokenizers vary by model.
 */
export function estimateTokens(text: string): number {
  return Math.ceil((countWords(text) * 133) / 100)
}

/** Split on whitespace; count non-empty tokens. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => token.length > 0).length
}

/**
 * Detect ATX headings (`#`..`######`) whose normalized text (lowercase,
 * trimmed) appears more than once. A leading frontmatter block is stripped
 * first so YAML content can never be mistaken for headings. Returns the
 * duplicate heading texts, unique, in order of second occurrence.
 */
export function findDuplicateSections(markdown: string): string[] {
  const body = markdown.replace(FRONTMATTER_RE, "")
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const line of body.split("\n")) {
    const match = line.match(/^#{1,6}\s+(.+)$/)
    if (!match) continue
    const normalized = match[1].trim().toLowerCase()
    if (seen.has(normalized)) {
      if (!duplicates.includes(normalized)) duplicates.push(normalized)
    } else {
      seen.add(normalized)
    }
  }
  return duplicates
}

/**
 * Count headings whose text matches /example/i — both ATX headings
 * ("## Examples") and bold label lines ("**Example 1:**"). Each matching
 * heading line counts once.
 */
export function countExamples(markdown: string): number {
  let count = 0
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim()
    const isHeading = /^#{1,6}\s+/.test(trimmed)
    const isBoldLabel = /^\*\*[^*]+\*\*/.test(trimmed)
    if ((isHeading || isBoldLabel) && /example/i.test(trimmed)) count += 1
  }
  return count
}

export function defaultBudgets(): BudgetLimits {
  return {
    skill_md: { warning_words: DEFAULT_SKILL_MD_WARNING_WORDS, error_words: null },
    frequent_skill: { warning_words: DEFAULT_FREQUENT_SKILL_WARNING_WORDS },
    reference_depth: { warning: DEFAULT_REFERENCE_DEPTH_WARNING },
  }
}

/**
 * Recursively list files under dir. Missing/unreadable directories produce
 * an empty list rather than throwing — a skill without references is fine.
 */
function listFiles(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

/** Nesting depth of file below root: top-level files are depth 1. */
function depthUnder(root: string, file: string): number {
  return relative(root, file).split(sep).length
}

function isEmptyDir(dir: string): boolean {
  if (!existsSync(dir)) return false
  try {
    return readdirSync(dir).length === 0
  } catch {
    return false
  }
}

/**
 * Lint a skill's context/token budget. Checks, in order:
 * skill_md_exists, frontmatter_valid, skill_md_words, skill_md_tokens,
 * references_count, reference_depth, largest_reference, duplicate_sections,
 * examples_count, progressive_disclosure.
 *
 * All file reads are wrapped in try/catch and produce error checks instead of
 * throwing; the only early return is a missing SKILL.md.
 */
export function lintSkillContext(
  skillPath: string,
  budgets?: BudgetLimits,
): LintResult {
  const skillMdPath = join(skillPath, "SKILL.md")

  if (!existsSync(skillMdPath)) {
    return {
      checks: [
        { check: "skill_md_exists", level: "error", message: "SKILL.md not found" },
      ],
      summary: { ok: 0, warning: 0, error: 1 },
    }
  }

  let content: string
  try {
    content = readFileSync(skillMdPath, "utf-8")
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      checks: [
        {
          check: "skill_md_exists",
          level: "error",
          message: `Failed to read SKILL.md: ${detail}`,
        },
      ],
      summary: { ok: 0, warning: 0, error: 1 },
    }
  }

  const defaults = defaultBudgets()
  const skillBudget = { ...defaults.skill_md, ...budgets?.skill_md }
  const frequentBudget = { ...defaults.frequent_skill, ...budgets?.frequent_skill }
  const depthBudget = { ...defaults.reference_depth, ...budgets?.reference_depth }

  const frontmatterMatch = content.match(FRONTMATTER_RE)
  const frontmatterText = frontmatterMatch ? frontmatterMatch[1] : ""
  const body = frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content

  const checks: BudgetCheck[] = []

  // -------------------------------------------------------------------------
  // skill_md_exists
  // -------------------------------------------------------------------------
  checks.push({
    check: "skill_md_exists",
    level: "ok",
    message: "SKILL.md exists",
  })

  // -------------------------------------------------------------------------
  // frontmatter_valid
  // -------------------------------------------------------------------------
  const frontmatterValid =
    content.startsWith("---") &&
    frontmatterMatch !== null &&
    /^name\s*:\s*\S/m.test(frontmatterText) &&
    /^description\s*:\s*\S/m.test(frontmatterText)
  checks.push({
    check: "frontmatter_valid",
    level: frontmatterValid ? "ok" : "error",
    message: frontmatterValid
      ? "Frontmatter present with name and description"
      : "Missing or invalid YAML frontmatter: SKILL.md must start with --- and define name and description",
  })

  const words = countWords(body)

  // Frequent-loading heuristic: substring check on the raw frontmatter text
  // for metadata.frequent == true or metadata.load == "always". Good enough
  // for linting; the real skill runtime is unaffected by this.
  const isFrequentLoading =
    /frequent:\s*true/.test(frontmatterText) || /load:\s*always/.test(frontmatterText)

  const warningWords = isFrequentLoading
    ? frequentBudget.warning_words ?? DEFAULT_FREQUENT_SKILL_WARNING_WORDS
    : skillBudget.warning_words ?? DEFAULT_SKILL_MD_WARNING_WORDS

  // -------------------------------------------------------------------------
  // skill_md_words
  // -------------------------------------------------------------------------
  if (typeof skillBudget.error_words === "number" && words > skillBudget.error_words) {
    checks.push({
      check: "skill_md_words",
      level: "error",
      message: `SKILL.md body is ${words} words, exceeding the configured error budget of ${skillBudget.error_words} words`,
    })
  } else if (words > warningWords) {
    checks.push({
      check: "skill_md_words",
      level: "warning",
      message: `SKILL.md body is ${words} words (warning above ${warningWords}${isFrequentLoading ? ", frequent-loading skill" : ""}); consider moving content to references/`,
    })
  } else {
    checks.push({
      check: "skill_md_words",
      level: "ok",
      message: `SKILL.md body is ${words} words (budget ${warningWords})`,
    })
  }

  // -------------------------------------------------------------------------
  // skill_md_tokens (informational)
  // -------------------------------------------------------------------------
  checks.push({
    check: "skill_md_tokens",
    level: "ok",
    message: `Estimated ~${estimateTokens(body)} tokens (${words} words; heuristic, not model-accurate)`,
  })

  // -------------------------------------------------------------------------
  // references
  // -------------------------------------------------------------------------
  const referencesDir = join(skillPath, "references")
  const referenceFiles = listFiles(referencesDir)

  // references_count
  if (referenceFiles.length > MAX_REFERENCE_FILES) {
    checks.push({
      check: "references_count",
      level: "warning",
      message: `${referenceFiles.length} reference files in references/ (budget ${MAX_REFERENCE_FILES}); consider consolidating`,
    })
  } else {
    checks.push({
      check: "references_count",
      level: "ok",
      message: `${referenceFiles.length} reference file${referenceFiles.length === 1 ? "" : "s"} in references/`,
    })
  }

  // reference_depth
  const maxDepth = referenceFiles.reduce(
    (max, file) => Math.max(max, depthUnder(referencesDir, file)),
    0,
  )
  const depthLimit = depthBudget.warning ?? DEFAULT_REFERENCE_DEPTH_WARNING
  checks.push({
    check: "reference_depth",
    level: maxDepth > depthLimit ? "warning" : "ok",
    message:
      maxDepth > depthLimit
        ? `Reference nesting depth ${maxDepth} exceeds budget of ${depthLimit}; consider flattening`
        : `Reference nesting depth ${maxDepth} (budget ${depthLimit})`,
  })

  // largest_reference
  let largest: { name: string; words: number } | null = null
  for (const file of referenceFiles) {
    let fileWords = 0
    try {
      fileWords = countWords(readFileSync(file, "utf-8"))
    } catch {
      fileWords = 0
    }
    if (!largest || fileWords > largest.words) {
      largest = { name: relative(referencesDir, file), words: fileWords }
    }
  }
  if (largest && largest.words > LARGEST_REFERENCE_WARNING_WORDS) {
    checks.push({
      check: "largest_reference",
      level: "warning",
      message: `Largest reference ${largest.name} is ${largest.words} words (>${LARGEST_REFERENCE_WARNING_WORDS}); consider splitting it, and add a table of contents if it exceeds 300 lines`,
    })
  } else {
    checks.push({
      check: "largest_reference",
      level: "ok",
      message: largest
        ? `Largest reference is ${largest.name} (${largest.words} words)`
        : "No reference files",
    })
  }

  // -------------------------------------------------------------------------
  // duplicate_sections
  // -------------------------------------------------------------------------
  const duplicates = findDuplicateSections(body)
  if (duplicates.length > 0) {
    const listed = duplicates
      .slice(0, MAX_DUPLICATES_LISTED)
      .map((duplicate) => `"${duplicate}"`)
      .join(", ")
    const more =
      duplicates.length > MAX_DUPLICATES_LISTED
        ? ` (+${duplicates.length - MAX_DUPLICATES_LISTED} more)`
        : ""
    checks.push({
      check: "duplicate_sections",
      level: "warning",
      message: `Duplicate section headings: ${listed}${more}`,
    })
  } else {
    checks.push({
      check: "duplicate_sections",
      level: "ok",
      message: "No duplicate section headings found",
    })
  }

  // -------------------------------------------------------------------------
  // examples_count (informational)
  // -------------------------------------------------------------------------
  const exampleCount = countExamples(body)
  checks.push({
    check: "examples_count",
    level: "ok",
    message: `Found ${exampleCount} example heading${exampleCount === 1 ? "" : "s"}`,
  })

  // -------------------------------------------------------------------------
  // progressive_disclosure
  // -------------------------------------------------------------------------
  if (words > DEFAULT_SKILL_MD_WARNING_WORDS && referenceFiles.length < 2) {
    checks.push({
      check: "progressive_disclosure",
      level: "warning",
      message: `SKILL.md body is ${words} words but references/ has ${referenceFiles.length} file${referenceFiles.length === 1 ? "" : "s"}; move long sections into references/ so the always-loaded body stays lean`,
    })
  } else if (isEmptyDir(join(skillPath, "scripts")) || isEmptyDir(join(skillPath, "assets"))) {
    checks.push({
      check: "progressive_disclosure",
      level: "ok",
      message: "scripts/ or assets/ exists but is empty; add content or remove the empty directory",
    })
  } else {
    checks.push({
      check: "progressive_disclosure",
      level: "ok",
      message: "Progressive disclosure looks good",
    })
  }

  const summary = { ok: 0, warning: 0, error: 0 }
  for (const check of checks) summary[check.level] += 1

  return { checks, summary }
}
