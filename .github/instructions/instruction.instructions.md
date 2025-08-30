---
applyTo: '**'
---

This is the monorepo for project called Sledge.
Sledge is pixel-based drawing tool made with Tauri v2, SolidJS and Vite.

Apps

- /apps/sledge ... main app
- /apps/website ... brand website (https://sledge-rules.app)

Packages

- /packages/core ... core package (some basic types and consts)
- /packages/theme ... theme package (reset/global styles, fonts, and color theme)
- /packages/ui ... ui package (common things such as Dropdown)
- /packages/wasm ... Some functions written in WASM (mostly low-level and heavy actions, such as flood fill)

Note that this is monorepo, hence terminal will start in root path.
However, you can use the commands below in root path.

- pnpm dev = start sledge app(equal to "cd apps/sledge; pnpm tauri dev")
- pnpm build = build sledge app(equal to "cd apps/sledge; pnpm tauri build")
- pnpm site:dev = start sledge website(equal to "cd apps/website; pnpm dev")
- pnpm site:build = build sledge website(equal to "cd apps/website; pnpm build")
- pnpm wasm:build = build wasm package(equal to "cd packages/wasm && pnpm --ignore-workspace i && wasm-pack build --target bundler". also note that sledge uses vite and "--target bundler" is a proper argument.)

"pnpm wasm:build" should be called after any change in packages/wasm.

Sledge app imports package(including wasm) via tsconfig and vite alias, not via workspace dependencies.
So you don't need to rebuild or "pnpm install" after building wasm package (or after changing other packages).

Note that you usually don't have to run "pnpm:build" to ensure that determine the changes are OK or not OK.
If you need to do that, just run "pnpm:dev" and ask for user to check the actual behavior.

Documents and comments are all meant to be written in English.
If you find some Japanese comment and it doesn't need to be Japanese, you should turn that line into English.

When user creates component in \*\*/components directory, use "Component" type from SolidJS, not "React.FC".
Like:

```tsx
import { Component } from 'solid-js';

const MyComponent: Component = () => {
  return <div>Hello, SolidJS!</div>;
};
```

User mostly use Powershell for development, then the separator for the bash commands is `;`.
