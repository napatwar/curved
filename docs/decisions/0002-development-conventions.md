---
status: accepted, partly superseded by 0003
date: 2026-11-08
---

# Development conventions

## Context and problem statement

Curved is open source, so many people will change the code. We need tools and rules that keep the code consistent without slowing contributors down. The rules themselves are in [conventions.md](../conventions.md). This record explains the choices.

The stack uses TypeScript 7, which affects which lint tools work.

## Considered options

- Lint and format: Oxlint with oxfmt, Biome, or ESLint with typescript-eslint and Prettier
- Branches: `main` only, or `develop` with `main`
- Dependency updates: Renovate or Dependabot

## Decision outcome

| Area               | Choice                                             | Reason                                                                                                    |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Lint               | Oxlint with type-aware rules                       | Runs type-aware rules on TypeScript 7, including `no-floating-promises`                                   |
| Format             | oxfmt                                              | Same toolchain as Oxlint, uses Prettier's output as its baseline, sorts imports and Tailwind classes      |
| Tests              | Vitest 5 and Playwright                            | Covers unit, integration against real Postgres, browser components, and multi-browser sync                |
| Git hooks          | lefthook                                           | Formats and lints staged files quickly; CI remains the real gate                                          |
| Branches           | `main` only, with short-lived branches             | Contributors open pull requests against the default branch                                                |
| Merging            | Squash merge, Conventional Commits in the PR title | One readable commit per change, without policing every commit                                             |
| DCO                | Probot DCO app                                     | The standard check that every commit has `Signed-off-by`                                                  |
| CI                 | GitHub Actions, with actions pinned by commit SHA  | Runs every check on each pull request and reduces supply chain risk                                       |
| Dependency updates | Renovate                                           | Waits 3 days for new releases and groups related packages, such as `@rocicorp/zero` with its Docker image |
| Decision records   | MADR format in `docs/decisions/`                   | A widely used ADR format                                                                                  |

### Consequences

- typescript-eslint did not support TypeScript 7 at the time of this decision. ESLint would have needed a second TypeScript version only for linting.
- oxfmt is still before 1.0. A formatter change mostly creates formatting diffs, not logic changes.
- Oxlint's type-aware mode may use a lot of memory on very large codebases.
- Integration and end-to-end tests need Docker locally. Unit tests do not.
- The DCO app and Renovate must be installed on the GitHub repository by a maintainer.

## More information

Not yet decided: release automation and changelogs, CODEOWNERS, internationalization, and a minimum test coverage.
