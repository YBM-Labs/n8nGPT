# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Monorepo Management

- `pnpm dev` - Start all applications in development mode
- `pnpm build` - Build all applications for production
- `pnpm lint` - Run linting across all packages
- `pnpm format` - Format code using Prettier
- `pnpm check-types` - Type check all TypeScript code

### Package-Specific Commands

Use Turbo filters to target specific packages:

- `pnpm dev --filter=n8ngpt-backend` - Run backend development server
- `pnpm dev --filter=n8n-extension` - Run extension development
- `pnpm build --filter=n8ngpt-backend` - Build backend only
- `pnpm build --filter=n8n-extension` - Build extension only

### Backend Development (apps/n8n-backend)

- `cd apps/n8n-backend && pnpm dev` - Start backend with hot reload (tsx watch)
- `cd apps/n8n-backend && pnpm build` - TypeScript compilation
- `cd apps/n8n-backend && pnpm start` - Run compiled backend

### Extension Development (apps/n8n-extension)

- `cd apps/n8n-extension && pnpm dev` - Chrome development mode
- `cd apps/n8n-extension && pnpm dev:firefox` - Firefox development mode
- `cd apps/n8n-extension && pnpm build` - Production build for Chrome
- `cd apps/n8n-extension && pnpm zip` - Create distribution package

## Architecture

This is a Turborepo monorepo with two main applications:

### n8ngpt Backend (apps/n8n-backend)

- **Framework**: Hono.js server with Node.js adapter
- **AI Integration**: OpenRouter API with AI SDK streaming
- **Purpose**: Backend API for AI chat functionality with n8n integration
- **Key Features**:
  - CORS-enabled API endpoint at `http://localhost:5000`
  - AI streaming chat with tool calling (paste_json_in_n8n tool)
  - System prompt loading from `SYSTEM_PROMPT.txt`
  - OpenRouter integration with multiple AI models

### n8ngpt Extension (apps/n8n-extension)

- **Framework**: WXT Chrome Extension framework with React 19
- **Purpose**: Chrome extension for AI-powered n8n workflow assistance
- **Architecture**: Manifest V3 extension with sidepanel interface
- **Key Components**:
  - `entrypoints/background.ts` - Service worker
  - `entrypoints/content.ts` - Content script for n8n integration
  - `entrypoints/sidepanel/` - Main AI chat interface
  - `components/ai-elements/` - AI chat UI components
  - `components/ui/` - Shadcn/ui component library

## Key Dependencies

### Backend Stack

- **Hono**: Lightweight web framework
- **AI SDK**: Vercel AI SDK for streaming responses
- **OpenRouter**: AI provider for multiple models
- **Zod**: Schema validation

### Extension Stack

- **WXT**: Modern Chrome extension development framework
- **React 19**: UI framework with concurrent features
- **Tailwind CSS v4**: Modern CSS framework
- **Radix UI**: Accessible component primitives
- **AI SDK React**: React hooks for AI integration

## Development Guidelines

### Chrome Extension Best Practices (from .cursor/rules)

- Follow Manifest V3 specifications strictly
- Use TypeScript with proper type definitions
- Implement functional programming patterns, avoid classes
- Use Service Worker for background scripts (MV3 requirement)
- Handle chrome.\* APIs with Promises
- Implement proper CSP and security practices
- Follow principle of least privilege for permissions
- Use chrome.i18n API for internationalization
- Ensure ARIA accessibility compliance

### Monorepo Structure

```
apps/
├── n8n-backend/          # Hono.js AI backend server
│   ├── src/index.ts      # Main server entry point
│   └── SYSTEM_PROMPT.txt # AI system prompt configuration
└── n8n-extension/        # Chrome extension
    ├── entrypoints/      # Extension entry points
    ├── components/       # React components
    └── CLAUDE.md         # Extension-specific guidelines

packages/                 # Shared packages (Turborepo structure)
```

### Integration Architecture

The extension communicates with the backend via HTTP API:

- Extension sidepanel → `http://localhost:5000` (AI backend)
- Backend uses OpenRouter for AI model access
- Extension can paste JSON workflows directly into n8n via content scripts
- Tool calling enables backend to trigger n8n workflow imports

## Package Manager

- **Required**: pnpm (specified in package.json engines)
- **Workspaces**: Configured via pnpm-workspace.yaml for monorepo management
- **Node Version**: Minimum Node.js 18+
