# n8ngpt

A Turborepo monorepo containing an AI-powered backend and Chrome extension for enhanced n8n workflow automation.

## Prerequisites

- Node.js 18+
- pnpm (required package manager)
- Chrome/Chromium browser (for extension development)

## Getting Started

1. **Install dependencies:**
```bash
pnpm install
```

2. **Set up environment variables:**
```bash
# Create .env in apps/n8n-backend/ with:
OPENROUTER_API_KEY=your_openrouter_api_key
```

3. **Start development:**
```bash
pnpm dev
```

## What's inside?

This Turborepo includes the following applications:

### Apps

- **`n8n-backend`**: Hono.js AI backend server with OpenRouter integration
- **`n8n-extension`**: Chrome extension with AI chat interface for n8n workflows

Each application is built with [TypeScript](https://www.typescriptlang.org/).

### Tools

This monorepo uses these development tools:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting  
- [Prettier](https://prettier.io) for code formatting
- [Turborepo](https://turbo.build/repo) for monorepo orchestration

## Development Commands

### All Applications
```bash
pnpm dev          # Start all applications in development mode
pnpm build        # Build all applications for production
pnpm lint         # Run linting across all packages
pnpm format       # Format code using Prettier
pnpm check-types  # Type check all TypeScript code
```

### Backend Development
```bash
pnpm dev --filter=n8ngpt-backend    # Start backend server (localhost:5000)
pnpm build --filter=n8ngpt-backend  # Build backend for production
```

### Extension Development
```bash
pnpm dev --filter=n8n-extension     # Start Chrome extension development
pnpm build --filter=n8n-extension   # Build extension for production
```

## License

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](LICENSE) file for details.

**Open Source**: You may use, modify, and distribute this software for any purpose, including commercial use.

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo login

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo login
yarn exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo link

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo link
yarn exec turbo link
pnpm exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
