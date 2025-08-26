# n8nGPT Extension - AI-Powered Workflow Assistant

A Chrome extension that brings AI-powered chat assistance and workflow management capabilities to n8n. Works with **all n8n instances** - including n8n Cloud, self-hosted deployments, and local development instances. Features intelligent workflow generation, JSON import utilities, and seamless integration across any n8n environment.

## ✨ Features

### 🤖 AI Chat Assistant

- **Smart Conversation Interface**: AI-powered chat using modern React components with real-time streaming
- **Multiple AI Models**: Support for Claude Sonnet 4, Gemini 2.0 Flash, and Deepseek R1
- **Context-Aware Responses**: Built-in tool calling capabilities for n8n-specific actions
- **Web Search Integration**: Optional web search functionality for enhanced responses

### 🔄 Universal n8n Integration

- **Universal n8n Support**: Automatically detects and works with n8n Cloud, self-hosted, and local instances
- **Instant Workflow Pasting**: One-click paste of JSON workflows directly into any n8n canvas
- **Smart Domain Detection**: Intelligent detection of n8n instances using DOM analysis and API patterns
- **Dynamic Permissions**: Automatically requests permissions for detected n8n instances
- **Intelligent Canvas Targeting**: Advanced canvas detection for reliable workflow pasting

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
- Any n8n instance (Cloud, self-hosted, or local)

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
4. Navigate to any n8n page (the extension will auto-detect and request permissions)

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
├── utils.ts         # Utility functions
└── n8n-detector.ts  # n8n instance detection utilities

CLAUDE.md           # Development guidelines
wxt.config.ts       # WXT configuration
```

## 🔧 Configuration

### Universal n8n Support

No configuration needed! The extension automatically:

- Detects n8n Cloud instances (`app.n8n.cloud` and subdomains)
- Identifies self-hosted n8n instances by analyzing DOM structure and API patterns
- Requests dynamic permissions for detected n8n instances
- Works with localhost and custom domain n8n installations

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

1. **Navigate to n8n**: Open any n8n instance in your browser (Cloud, self-hosted, or local)
2. **Automatic Detection**: Extension detects n8n and shows a "n8n GPT Ready" indicator
3. **Open Sidepanel**: Click the extension icon to open the AI assistant
4. **Generate Workflows**: Ask the AI to create n8n workflows for your automation needs
5. **Instant Paste**: Generated workflows are automatically pasted into the n8n canvas
6. **Loading Feedback**: Visual indicators show when workflows are being processed and pasted

## 🛠️ Development Commands

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `pnpm dev`           | Start development server for Chrome  |
| `pnpm dev:firefox`   | Start development server for Firefox |
| `pnpm build`         | Build extension for Chrome           |
| `pnpm build:firefox` | Build extension for Firefox          |
| `pnpm zip`           | Create Chrome extension package      |
| `pnpm compile`       | Type check without building          |
| `pnpm postinstall`   | Prepare WXT development environment  |

## 🔒 Permissions

The extension requires the following permissions:

- `sidePanel`: For the AI assistant interface
- `tabs`: To interact with n8n tabs
- `scripting`: To inject workflow import scripts
- `activeTab`: For current tab information
- `clipboardWrite`: For workflow clipboard operations
- `debugger`: For network monitoring to capture workflow data
- **Dynamic host permissions**: Automatically requested for detected n8n instances

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the existing code style
4. Test thoroughly with different n8n scenarios
5. Submit a pull request

## 🆕 What's New

### Universal n8n Support

- ✅ **No more hardcoded domains** - works with any n8n instance
- ✅ **Smart detection** for n8n Cloud (`app.n8n.cloud`) and self-hosted instances
- ✅ **Dynamic permissions** requested automatically per instance
- ✅ **Visual indicators** when extension is active on n8n pages

### Enhanced User Experience

- ✅ **Proper loading states** during workflow generation and pasting
- ✅ **Error handling** with clear user feedback
- ✅ **Success confirmation** when workflows are pasted
- ✅ **Better canvas targeting** for reliable workflow imports

### Technical Improvements

- ✅ **Modular n8n detection** with dedicated utility library
- ✅ **TypeScript improvements** with better type safety
- ✅ **Content script optimization** with conditional execution
- ✅ **Permission model** using optional host permissions

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [WXT Framework](https://wxt.dev/) for modern extension development
- UI components powered by [Radix UI](https://www.radix-ui.com/)
- Styling with [Tailwind CSS v4](https://tailwindcss.com/)
- AI integration using [AI SDK](https://sdk.vercel.ai/)
- Icons from [Lucide React](https://lucide.dev/)
