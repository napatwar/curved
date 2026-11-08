---
status: accepted
date: 2026-11-08
---

# Defer DCO and Renovate

## Context and problem statement

[0001](0001-tech-stack.md) chose the DCO for contributions, and [0002](0002-development-conventions.md) chose the Probot DCO app and Renovate. Both add review work for the maintainer over time.

Curved currently has one developer, so neither gives much value yet.

## Considered options

- Keep both now
- Defer both until the project is ready for outside contributors

## Decision outcome

Chosen option: defer both. This record replaces the DCO choice in 0001 and the DCO app and Renovate choices in 0002. The rest of those records still applies.

### Consequences

- Good, because the maintainer has no sign-off checks or dependency update pull requests to review.
- Bad, because dependencies are updated by hand. Keep `@rocicorp/zero` in every `package.json` equal to the `rocicorp/zero` image in `docker-compose.yml`.
- Bad, because an outside contribution would arrive with no sign-off record, only under the repository's license through GitHub's terms of service.

## More information

Before accepting the first outside contribution, decide between the DCO and a CLA again, and add the matching check. 0001 explains how each affects relicensing.

Revisit Renovate, or another update tool, when manual updates become a burden.
