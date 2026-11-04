# Next.js One-Click Project Creator

Create a new Next.js project from inside VS Code without typing `create-next-app` prompts by hand. Fill in a simple form, click **Create Project**, and the extension runs `create-next-app@latest` with your chosen flags and opens the new project.

## Features

- Sidebar form (Activity Bar icon) and a status bar button: **Create Next.js App**
- TypeScript (tsx) or JavaScript (jsx)
- Linter: ESLint, Biome or None
- Tailwind CSS, React Compiler, AGENTS.md, `src/` directory, App Router, Turbopack
- Cache Components: Default, Enable or Disable
- Custom import alias (default `@/*`)
- Package manager: npm, pnpm, yarn or bun
- Open the project in the current window, a new window, or be asked each time
- **Save as defaults** to remember your favorite setup
- Live command output in the **Next.js Creator** output channel

## Usage

1. Click the Next.js Creator icon in the Activity Bar (or the **Create Next.js App** button in the status bar, or run `Next.js: Create Project` from the Command Palette).
2. Enter a project name (lowercase letters, numbers, `-` or `_`).
3. Choose a location with **Browse**.
4. Pick your options and click **Create Project**.

## Requirements

- Node.js and npm (or pnpm / yarn / bun if you choose one)
- Internet connection (the extension runs `npx create-next-app@latest`)

## Extension Settings

| Setting | Default | Description |
| --- | --- | --- |
| `nextCreator.defaultFolder` | `""` | Where new projects are created |
| `nextCreator.language` | `typescript` | `typescript` or `javascript` |
| `nextCreator.tailwind` | `true` | Use Tailwind CSS |
| `nextCreator.linter` | `eslint` | `eslint`, `biome` or `none` |
| `nextCreator.reactCompiler` | `false` | Enable React Compiler |
| `nextCreator.cacheComponents` | `default` | `default`, `on` or `off` |
| `nextCreator.agentsMd` | `true` | Include AGENTS.md |
| `nextCreator.srcDir` | `false` | Use `src/` directory |
| `nextCreator.appRouter` | `true` | Use App Router |
| `nextCreator.turbopack` | `false` | Use Turbopack |
| `nextCreator.importAlias` | `@/*` | Import alias |
| `nextCreator.packageManager` | `npm` | `npm`, `pnpm`, `yarn` or `bun` |
| `nextCreator.openAfterCreate` | `ask` | `ask`, `currentWindow` or `newWindow` |

## Notes

- Available flags depend on your `create-next-app` version. If a flag is not supported, the error appears in the **Next.js Creator** output channel.

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

To build a `.vsix` package:

```bash
npx @vscode/vsce package
```

## License

Free to use for everyone, but copying, modifying, redistributing or reselling is not allowed. See [LICENSE](LICENSE) for details.