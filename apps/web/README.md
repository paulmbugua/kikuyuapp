# Thutha Web

The Thutha web experience is a Next.js App Router application.

From the repository root, install dependencies with:

```powershell
yarn install
```

Run the web app:

```powershell
cd apps/web
yarn dev
```

Open `http://localhost:8080`.

Production checks:

```powershell
yarn type-check
yarn lint
yarn build
```

Copy `.env.example` to `.env.local` when overriding the local API URL or configuring Firebase.
