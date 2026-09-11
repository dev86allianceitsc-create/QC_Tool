# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is a pnpm monorepo. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

### Web Application (Frontend)

- `apps/web/src/main.tsx` - React entrypoint; imports `apps/web/src/index.css` and mounts `apps/web/src/App.tsx` into the `#root` element
- `apps/web/src/App.tsx` - Primary application component and the usual starting point for UI work
- `apps/web/src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `apps/web/index.html` - Vite HTML shell containing the `#root` element and loading `apps/web/src/main.tsx`
- `apps/web/package.json` - Frontend dependencies and the Vite build, development, preview, and formatting scripts
- `apps/web/vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `apps/web/tsconfig.json` - TypeScript configuration with `@` alias for `apps/web/src`

### Monorepo Root

- `package.json` - Root workspace configuration with convenient scripts (`pnpm dev:web`, `pnpm build:web`, etc.)
- `pnpm-workspace.yaml` - pnpm workspace declaration
- `.mise.toml` - Toolchain versions for Node.js and pnpm
- `packages/shared-types/` - Shared type definitions (scaffold)
- `prisma/` - Database infrastructure (placeholder)
- `document/` - Authoritative requirements, API design, database design, UI mapping

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
