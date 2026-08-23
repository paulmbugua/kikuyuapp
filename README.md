# Thutha — Kikuyu Social Platform

Thutha is a modern social home for Agĩkũyũ stories, creators, conversations, short video, community discovery, and creator commerce.

## Stack

- Yarn 4 workspaces with the node-modules linker
- Next.js App Router for the web experience
- Express, PostgreSQL, and Socket.IO for the backend
- Tailwind CSS and shadcn/ui for the design system

## Requirements

- Node.js 20.9 or newer
- Corepack enabled
- PostgreSQL
- Firebase Admin and Cloudinary credentials for the backend

## Install once

From the repository root:

```powershell
corepack enable
yarn install
```

## Run the backend

```powershell
cd apps/backend
Copy-Item .env.example .env
# Fill in the real values in .env
yarn server
```

The backend runs at `http://localhost:5000` and the API base is `http://localhost:5000/api/v1`.

## Run the web app

In a second terminal:

```powershell
cd apps/web
Copy-Item .env.example .env.local
yarn dev
```

The web app runs at `http://localhost:8080`.

## Run both from the root

```powershell
yarn dev
```

Useful root commands:

- `yarn server` — backend with Nodemon
- `yarn dev:web` — Next.js development server
- `yarn build` — production web build
- `yarn type-check` — web TypeScript validation

Environment files are intentionally ignored. Commit only the provided `.env.example` templates.
