# ⛏️ Minecraft agent player for [アイリ (Airi)](https://airi.moeru.ai)

> [!WARNING]
>
> As the PoC and initial implementation has been achieved, as well as since all the [`airi-minecraft`](https://github.com/moeru-ai/airi-minecraft) history of changes has been merged in to the meta repo of [`airi`](https://github.com/moeru-ai/airi) under [`services/minecraft`](https://github.com/moeru-ai/airi/tree/main/services/minecraft) directory with [`219407a`](https://github.com/moeru-ai/airi/commit/219407aacaaa8d371d7b916f040667fc4f77f474) commit, this repository will be archived and no longer maintained.
>
> If you wish to take a closer look on how we implemented it, please go to: [`services/minecraft`](https://github.com/moeru-ai/airi/tree/main/services/minecraft).
>
> This doesn't mean [アイリ (Airi)](https://airi.moeru.ai) was discontinued, we are still actively maintain and developing it to achieve out roadmap. As always, you are welcome to join us and contribute to [`airi`](https://github.com/moeru-ai/airi).

> [!NOTE]
>
> This project is part of the [Project アイリ (Airi)](https://github.com/moeru-ai/airi), we aim to build a LLM-driven VTuber like [Neuro-sama](https://www.youtube.com/@Neurosama) (subscribe if you didn't!) if you are interested in, please do give it a try on [live demo](https://airi.moeru.ai).

An intelligent Minecraft bot powered by LLM. AIRI can understand natural language commands, interact with the world, and assist players in various tasks.

## 🎥 Preview

![demo](./docs/preview.png)

## ✨ Features

- 🗣️ Natural language understanding
- 🏃‍♂️ Advanced pathfinding and navigation
- 🛠️ Block breaking and placing
- 🎯 Combat and PvP capabilities
- 🔄 Auto-reconnect on disconnection
- 📦 Inventory management
- 🤝 Player following and interaction
- 🌍 World exploration and mapping

## 🚀 Getting Started

### 📋 Prerequisites

- 📦 Node.js 22+
- 🔧 pnpm
- 🎮 A Minecraft server (1.20+)

### 🔨 Installation

1. Clone the repository:

```bash
git clone https://github.com/moeru-ai/airi-minecraft.git
cd airi-mc
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env.local` file with your configuration:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_BASEURL=your_openai_api_baseurl

BOT_USERNAME=your_bot_username
BOT_HOSTNAME=localhost
BOT_PORT=25565
BOT_PASSWORD=optional_password
BOT_VERSION=1.20
```

4. Start the bot:

```bash
pnpm dev
```

## 🎮 Usage

Once the bot is connected, you can interact with it using chat commands in Minecraft. All commands start with `#`.

### Basic Commands

- `#help` - Show available commands
- `#follow` - Make the bot follow you
- `#stop` - Stop the current action
- `#come` - Make the bot come to your location

### Natural Language Commands

You can also give the bot natural language commands, and it will try to understand and execute them. For example:

- "Build a house"
- "Find some diamonds"
- "Help me fight these zombies"
- "Collect wood from nearby trees"

## 🛠️ Development

### Project Structure

```
src/
├── agents/     # AI agent implementations
├── composables/# Reusable composable functions
├── libs/       # Core library code
├── mineflayer/ # Mineflayer plugin implementations
├── prompts/    # AI prompt templates
├── skills/     # Bot skills and actions
└── utils/      # Utility functions
```

### Commands

- `pnpm dev` - Start the bot in development mode
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm test` - Run tests

## 🙏 Acknowledgements

- https://github.com/kolbytn/mindcraft

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
