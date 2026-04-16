# near-wallet-creation

Minimal full-stack NEAR implementation with:

- Frontend: React + TypeScript + `near-api-js` + `@near-wallet-selector/core`
- Backend: Node.js + Express (`/api/store-key`)

## Frontend behavior

- `Connect Wallet` button uses NEAR Wallet Selector.
- After connection, user submits a `username`.
- App generates a random Ed25519 key pair via:
  - `nearApi.utils.KeyPair.fromRandom('ed25519')`
- App constructs a transaction for `memdex.username.near` containing:
  - `CreateAccount()`
  - `Transfer(0.1 NEAR)`
  - `AddKey()` with generated public key and full-access permission
- After on-chain confirmation, app POSTs `{ accountId, secretKey }` to backend `/api/store-key`.

## Backend behavior

- `POST /api/store-key` validates:
  - `accountId` follows `memdex.username.near`
  - `secretKey` starts with `ed25519:`
- Includes inline AES-256-GCM encryption guidance comments for secure PostgreSQL persistence.

## Run locally

### 1) Backend

```bash
cd backend
npm install
npm run start
```

Runs on `http://localhost:3001`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

Optional frontend env vars:

- `VITE_NEAR_NETWORK` (default `testnet`)
- `VITE_NEAR_CONTRACT_ID` (default `memdex.near`)
- `VITE_BACKEND_URL` (default `http://localhost:3001`)
