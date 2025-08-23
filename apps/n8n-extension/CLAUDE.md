# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Start development server for Chrome
- `pnpm dev:firefox` - Start development server for Firefox
- `pnpm build` - Build extension for Chrome
- `pnpm build:firefox` - Build extension for Firefox
- `pnpm zip` - Create Chrome extension package
- `pnpm zip:firefox` - Create Firefox extension package
- `pnpm compile` - Type check without building
- `pnpm postinstall` - Prepare WXT development environment

## Architecture

This is a Chrome extension built with:
- **WXT Framework** - Modern Chrome extension framework with TypeScript support
- **React 19** - UI framework for popup and sidebar components  
- **TailwindCSS v4** - Styling with modern CSS framework
- **Radix UI** - UI component primitives

### Project Structure
```
entrypoints/          # Extension entry points
├── background.ts     # Service worker (Manifest V3)
├── content.ts        # Content script (runs on google.com)
├── popup/           # Extension popup
│   ├── App.tsx      # Main popup component
│   └── index.html   # Popup HTML
└── sidebar/         # Sidebar component
    └── index.tsx

components/          # React components
└── ui/             # Shadcn/ui components
    └── button.tsx

lib/
└── utils.ts        # Utility functions (clsx/tailwind-merge)
```

### Key Architectural Patterns
- Uses WXT's `defineBackground()`, `defineContentScript()` patterns
- React components use functional patterns, avoid classes
- Content script targets Google domains (`*://*.google.com/*`)
- Shadcn/ui component library for consistent UI components
- Path aliases: `@/` maps to project root for imports

### Development Guidelines (from .cursor/rules)
- Follow Manifest V3 specifications strictly
- Use TypeScript with proper type definitions
- Implement functional programming patterns
- Use Service Worker for background scripts (MV3 requirement)
- Handle chrome.* APIs with Promises
- Implement proper CSP and security practices
- Follow principle of least privilege for permissions
- Use chrome.i18n API for internationalization
- Ensure ARIA accessibility compliance