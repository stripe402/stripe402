# Contributing to stripe402

Thanks for your interest in contributing to stripe402! This document covers the process for contributing and the requirements for accepting contributions.

## Getting Started

1. Fork the repository
2. Clone your fork and create a branch from `main`
3. Install dependencies: `pnpm install`
4. Make your changes
5. Run tests: `pnpm test`
6. Run type checking: `pnpm typecheck`
7. Push your branch and open a pull request

## Development

```bash
pnpm install        # Install dependencies
pnpm build          # Build all packages
pnpm test           # Run tests
pnpm test:coverage  # Run tests with coverage
pnpm typecheck      # Type check all packages
pnpm clean          # Clean build artifacts
```

## Pull Requests

- Keep PRs focused on a single change
- Include tests for new functionality
- Ensure all tests pass and type checking succeeds
- Write a clear description of what your PR does and why

## Reporting Issues

Use GitHub Issues to report bugs or suggest features. Please include:

- A clear description of the problem or suggestion
- Steps to reproduce (for bugs)
- Expected vs. actual behavior (for bugs)
- Your environment (Node.js version, OS, etc.)

## Contributor License Agreement (CLA)

By submitting a contribution to this project, you agree to the following terms:

1. **Grant of Rights.** You grant Lance Whatley (the project maintainer) a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license to use, reproduce, modify, sublicense, relicense, and distribute your contributions as part of this project or any derivative works, under any license.

2. **Original Work.** You represent that your contribution is your original work and that you have the right to grant the above license.

3. **No Obligation.** The maintainer is under no obligation to accept or include your contribution.

This CLA ensures the project maintainer retains the ability to relicense the project if needed (e.g., during an acquisition or license change), while your contributions remain available under the project's open-source license.

### How to Sign

By opening a pull request, you affirm that you agree to this CLA. No separate signature is required.

## Code of Conduct

Be respectful, constructive, and inclusive. We're all here to build something useful.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
