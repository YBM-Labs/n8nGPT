# n8ngpt Extension - AI-Powered Workflow Assistant

A Chrome extension that brings AI-powered chat assistance and workflow management capabilities to n8n, featuring intelligent workflow generation, JSON import utilities, and seamless integration with self-hosted n8n instances.

## ✨ Features

### 🤖 AI Chat Assistant
- **Smart Conversation Interface**: AI-powered chat using modern React components with real-time streaming
- **Multiple AI Models**: Support for Claude Sonnet 4, Gemini 2.0 Flash, and Deepseek R1
- **Context-Aware Responses**: Built-in tool calling capabilities for n8n-specific actions
- **Web Search Integration**: Optional web search functionality for enhanced responses

### 🔄 n8n Workflow Integration  
- **Instant Workflow Pasting**: One-click paste of JSON workflows directly into n8n canvas
- **API-First Import**: Intelligent workflow import using n8n's REST API when available
- **Multiple Import Methods**: Fallback clipboard-based import for maximum compatibility
- **Permission Management**: Dynamic permission requests for secure cross-origin access

### 🎨 Modern UI/UX
- **Sidepanel Interface**: Clean, resizable sidepanel that doesn't interfere with n8n workflow
- **Responsive Design**: Fully responsive interface using Tailwind CSS v4
- **Accessible Components**: Built with Radix UI primitives for optimal accessibility
- **Theme Integration**: Seamless integration with system/browser themes

### 🔧 Technical Architecture
- **Manifest V3**: Modern Chrome extension using service workers
- **React 19**: Latest React with concurrent features and modern hooks
- **TypeScript**: Fully typed codebase with strict TypeScript configuration
- **WXT Framework**: Modern extension development with hot reload and build optimization

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Chrome/Chromium browser
- n8n instance at `https://magic.yourbrandmate.agency` (or modify config)

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd n8n-extension
   pnpm install
   ```

2. **Development Mode**
   ```bash
   pnpm dev          # Chrome development
   pnpm dev:firefox  # Firefox development
   ```

3. **Production Build**
   ```bash
   pnpm build        # Chrome production build
   pnpm build:firefox # Firefox production build
   pnpm zip          # Create distribution package
   ```

### Chrome Extension Setup

1. Open `chrome://extensions/`
2. Enable "Developer mode"  
3. Click "Load unpacked" and select the `.output/chrome-mv3` directory
4. Grant permissions when prompted for n8n host access

## 🏗️ Project Structure

```
entrypoints/          # Extension entry points
├── background.ts     # Service worker (Manifest V3)
├── content.ts        # Content script for n8n integration
├── popup/           # Extension popup
│   ├── App.tsx      # Simple popup launcher
│   └── index.html   
└── sidepanel/       # Main AI assistant interface
    ├── App.tsx      # AI chat interface
    └── index.html   

components/          # Shared React components
├── ai-elements/     # AI chat UI components
│   ├── conversation.tsx
│   ├── message.tsx
│   ├── prompt-input.tsx
│   └── ...
└── ui/              # Base UI components (shadcn/ui)
    ├── button.tsx
    ├── badge.tsx
    └── ...

lib/
└── utils.ts         # Utility functions

CLAUDE.md           # Development guidelines
wxt.config.ts       # WXT configuration
```

## 🔧 Configuration

### n8n Host Configuration
Update the host permissions in `wxt.config.ts`:

```typescript
manifest: {
  host_permissions: ["https://your-n8n-instance.com/*"],
}
```

### AI Backend Configuration
The sidepanel expects an AI backend at `http://localhost:5000`. Configure in `entrypoints/sidepanel/App.tsx`:

```typescript
const { messages, sendMessage, status, addToolResult } = useChat({
  transport: new DefaultChatTransport({
    api: "http://your-ai-backend-url",
  }),
  // ...
});
```

## 🎯 Usage

1. **Open Extension**: Click the extension icon to open the sidepanel
2. **AI Chat**: Ask questions about n8n workflows, automation strategies, or technical help
3. **Workflow Import**: Use the AI to generate workflows or manually paste JSON workflows
4. **Direct Integration**: Workflows are automatically imported into your active n8n tab

## 🛠️ Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server for Chrome |
| `pnpm dev:firefox` | Start development server for Firefox |
| `pnpm build` | Build extension for Chrome |
| `pnpm build:firefox` | Build extension for Firefox |
| `pnpm zip` | Create Chrome extension package |
| `pnpm compile` | Type check without building |
| `pnpm postinstall` | Prepare WXT development environment |

## 🔒 Permissions

The extension requires the following permissions:
- `sidePanel`: For the AI assistant interface
- `tabs`: To interact with n8n tabs
- `scripting`: To inject workflow import scripts
- `activeTab`: For current tab information
- `clipboardWrite`: For workflow clipboard operations
- Host permission for your n8n instance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the existing code style
4. Test thoroughly with different n8n scenarios
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [WXT Framework](https://wxt.dev/) for modern extension development
- UI components powered by [Radix UI](https://www.radix-ui.com/)
- Styling with [Tailwind CSS v4](https://tailwindcss.com/)
- AI integration using [AI SDK](https://sdk.vercel.ai/)
- Icons from [Lucide React](https://lucide.dev/)
