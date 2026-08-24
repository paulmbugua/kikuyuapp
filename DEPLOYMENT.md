# Thutha deployment

## Cloudflare Worker (web)

Set the Cloudflare project root directory to `apps/web`.

- Build command: `corepack enable && yarn install --immutable && yarn cf:build`
- Deploy command: `yarn cf:deploy`

The non-secret production web variables and both custom domains are defined in `apps/web/wrangler.json` and are uploaded by Wrangler during deployment.

## Railway (backend)

Keep the Railway root directory at the repository root.

- Build command: `corepack enable && yarn install --immutable && yarn workspace @kikuyu/backend build`
- Start command: `yarn workspace @kikuyu/backend start`
- Health check: `/api/v1/health`

Configure these backend values in Railway Variables. Do not place secrets in Wrangler or Git:

`NODE_ENV=production`, `PORT`, `API_PREFIX`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `WEB_BACKEND_URL`, `CORS_ORIGIN`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `R2_ENDPOINT`, `R2_REGION`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_IMAGES`, `R2_PUBLIC_BASE_URL_IMAGES`, `R2_BUCKET_COVER`, `R2_PUBLIC_BASE_URL_COVER`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

Add M-Pesa variables when payments are enabled: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_BUSINESS_SHORTCODE`, `MPESA_ENVIRONMENT`, and `MPESA_CALLBACK_URL`.

Production URL values:

- `WEB_BACKEND_URL=http://localhost:4002`
- `CORS_ORIGIN=https://thutha.co.ke,https://www.thutha.co.ke`
- `FRONTEND_URL=https://www.thutha.co.ke,https://thutha.co.ke`
- `GOOGLE_CALLBACK_URL=https://server.thutha.co.ke/api/v1/auth/google/callback`

`FRONTEND_URL` and `CORS_ORIGIN` accept comma-separated origins. The first `FRONTEND_URL` is the default OAuth return origin; the signed OAuth state preserves whichever allowed domain initiated login. `WEB_BACKEND_URL` is the backend's self URL and does not control the listening port; Railway's injected `PORT` remains authoritative.
