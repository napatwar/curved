# Contributing

Thank you for helping with Curved. Read [the conventions](docs/conventions.md) before you open a pull request.

## Set up

Follow [Getting started](README.md#getting-started). Running `pnpm install` also installs Git hooks that format and lint the files you commit.

## Make a change

1. Create a branch from `main`, such as `feat/issue-board`.
2. Make your change, with tests.
3. Run the checks:

   ```bash
   pnpm check
   ```

4. Run the end-to-end tests if you changed sync or user flows:

   ```bash
   pnpm test:e2e
   ```

5. Open a pull request with a [Conventional Commits](https://www.conventionalcommits.org/) title, such as `feat: add issue board`.

## License

Your contribution is licensed under [AGPL-3.0-only](LICENSE), unless the package you change states a different license.

## Report a security issue

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
