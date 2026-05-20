# Ticket 005: Code quality tooling (ESLint, Prettier, Husky, commitlint)

## Status
Draft

## Phase
Phase 0: Setup and Foundation

## Priority
P1

## Feature Area
Infrastructure

## Context
Consistent code formatting, linting, and commit message conventions are prerequisites for a codebase that more than one engineer will touch. Without pre-commit hooks enforcing TypeScript, linting, and formatting before code reaches the repository, reviews become cluttered with formatting noise and type errors accumulate across branches. This ticket establishes the quality gates that will run on every commit. These gates are also what developers check before marking any ticket done (the completion checklist references `tsc --noEmit` and `npm run lint`). Source documents: `docs/blacqlist/architecture/tech-stack-decision.md` (Section 2, TypeScript Strict Mode section); relevant conventions are derived from the CLAUDE.md release rules.

## User Story
As an engineer committing code, I want automated pre-commit checks that block commits failing TypeScript type checking, ESLint rules, or Prettier formatting, so that the main branch always contains typed, linted, consistently formatted code.

## Scope
- Configure ESLint extending `next/core-web-vitals` and `@typescript-eslint/recommended`
- Configure Prettier with: single quotes, semicolons, trailing commas (`all`), 100-character print width, 2-space indent
- Install and configure Husky with a `pre-commit` hook running `tsc --noEmit && eslint . && prettier --check .`
- Install `lint-staged` and configure it to run lint/format checks only on staged files (not the entire codebase on every commit)
- Install and configure `commitlint` with `@commitlint/config-conventional` to enforce conventional commit message format
- Add `package.json` scripts: `"lint"`, `"lint:fix"`, `"type-check"`, `"format"`, `"format:check"`
- Create `.prettierignore` to exclude `node_modules`, `.next`, and generated files
- Create `.eslintignore` to exclude the same directories

## Out of Scope
- CI/CD pipeline for lint checks (Vercel runs `next build` which includes type checking; a separate CI pipeline is a later concern)
- Automated testing setup (a separate ticket if needed)
- Semantic release or automated versioning

## Dependencies
- Depends on: Ticket 001 — Next.js project initialization (ESLint config extends `next/core-web-vitals` which is installed by the Next.js scaffolding)

## UX Notes
N/A — infrastructure ticket. These tools run during development and in CI; they have no user-facing output.

## Design Notes
N/A — infrastructure ticket.

## Data Notes
N/A — no database interaction.

## API Notes
N/A — no API routes.

## Implementation Notes

**Files to create or modify:**

- `eslint.config.mjs` (or `.eslintrc.json` depending on Next.js 14 ESLint version — prefer flat config):

```js
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Warn on any — do not allow `any` without a comment
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disallow ts-ignore without explanation
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-ignore': 'allow-with-description',
        'ts-expect-error': 'allow-with-description',
      }],
      // Require explicit return types on functions (prevents accidental void returns)
      '@typescript-eslint/explicit-function-return-type': 'off', // Too noisy for React components — keep off
      // Consistent imports
      'import/order': 'off', // Not installed; handle manually
    },
  },
]

export default eslintConfig
```

- `.prettierrc`:
```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

- `.prettierignore`:
```
node_modules
.next
.vercel
*.generated.*
supabase/migrations
```

- `.husky/pre-commit`:
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged
```

- `.lintstagedrc.json`:
```json
{
  "*.{ts,tsx}": [
    "tsc --noEmit",
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,css}": [
    "prettier --write"
  ]
}
```

Note: `tsc --noEmit` runs on all staged TS files by running the full type check — this is intentional because TypeScript checks the entire project graph, not just staged files. On large codebases this can be slow; at MVP scale it is acceptable.

- `commitlint.config.ts`:
```typescript
import type { UserConfig } from '@commitlint/types'

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'test', 'perf', 'ci', 'revert'
    ]],
    'subject-max-length': [2, 'always', 100],
  },
}

export default config
```

- `.husky/commit-msg`:
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx --no -- commitlint --edit "$1"
```

- `package.json` scripts section additions:
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  }
}
```

**Installation commands:**
```sh
pnpm add -D @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier lint-staged husky @commitlint/cli @commitlint/config-conventional @commitlint/types
npx husky init
```

**Key patterns:**
- `lint-staged` runs checks only on staged files, keeping pre-commit hooks fast
- Husky `prepare` script ensures hooks are installed on `pnpm install` for all engineers who clone the repo
- `tsc --noEmit` in the pre-commit hook runs a full project type check (not per-file) — this is the correct behavior for catching type errors that span multiple files
- Prettier is run after ESLint fix to ensure final formatting is consistent

**Do not:**
- Add `eslint-disable` comments without an explanatory reason
- Use `@ts-ignore` — use `@ts-expect-error` with a description if unavoidable
- Configure Prettier print width above 100 — wide lines reduce readability in side-by-side diffs
- Add `eslint-plugin-import` or `eslint-plugin-react` — Next.js ESLint config already includes them

## Acceptance Criteria
- [ ] `pnpm lint` runs without errors on the current codebase (Ticket 001 placeholder code)
- [ ] `pnpm type-check` runs `tsc --noEmit` and exits with code 0
- [ ] `pnpm format:check` runs Prettier check and exits with code 0 on all current files
- [ ] Attempting to commit a file with a TypeScript error is blocked by the pre-commit hook with a descriptive error message
- [ ] Attempting to commit a file with unresolved ESLint errors is blocked by the pre-commit hook
- [ ] Attempting to commit with a non-conventional commit message (e.g., `git commit -m "stuff"`) is blocked by the commit-msg hook
- [ ] A valid conventional commit message (e.g., `feat: add Tailwind brand colors`) passes the commit-msg hook
- [ ] `pnpm prepare` installs Husky hooks in a fresh `git clone` without errors
- [ ] `.prettierignore` excludes `supabase/migrations/` from formatting (SQL files should not be Prettierized)

## Failure States
| Failure | User-visible behavior |
|---|---|
| Husky hooks not installed after `git clone` | Pre-commit hook does not run; engineer runs `pnpm install` (which triggers `prepare` and installs hooks) |
| `tsc --noEmit` in pre-commit hook takes longer than 30s on large branches | Engineer waits for type check to complete; if routinely slow, evaluate switching to incremental mode (`--incremental`) |
| `lint-staged` runs on `.sql` migration files and breaks them | Prettier reformats SQL incorrectly; add `supabase/migrations/**` to `.prettierignore` |
| commitlint blocks a valid commit message due to scope format | Engineer updates the commit message to match conventional format (e.g., `fix(auth): resolve session timeout`) |

## Edge Cases
- If an engineer uses a Git GUI (SourceTree, GitKraken) instead of the terminal, Husky hooks may not run — document that all commits must pass pre-commit checks before PR approval regardless of local hook status
- The `tsc --noEmit` check in `lint-staged` runs the full project type check, not just the staged files — this is a deliberate tradeoff; if it becomes a bottleneck, switch to a cached incremental check
- Commitlint does not run on merge commits by default — this is acceptable behavior; merge commits are generated by Git and do not follow conventional format

## Accessibility Notes
- [ ] N/A — infrastructure ticket.

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Pre-commit blocks TypeScript error | Engineer | Introduce a deliberate type error in `lib/utils.ts`; stage and attempt to commit | Pre-commit hook runs, outputs TypeScript error, and rejects the commit |
| 2 | Pre-commit allows valid code | Engineer | Stage `lib/utils.ts` with valid TypeScript; commit with message `chore: verify pre-commit hooks` | Commit succeeds; hook output shows zero errors |
| 3 | Commit message linting | Engineer | Attempt `git commit -m "updated stuff"` | commit-msg hook rejects the commit with message about conventional format |
| 4 | Valid commit message | Engineer | Commit with `feat(infra): add code quality tooling` | Commit is accepted |

## Security Notes
- No security implications specific to this ticket — linting and commit tooling does not interact with production data or credentials
- Ensure `.eslintignore` excludes generated files that may contain patterns that trigger false positives

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — N/A for infrastructure ticket
- [ ] Mobile tested at 375px — N/A for infrastructure ticket
- [ ] Keyboard navigation tested — N/A for infrastructure ticket
- [ ] Accessibility requirements met — N/A for infrastructure ticket
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
