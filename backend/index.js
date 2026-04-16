const express = require('express')
const cors = require('cors')

const app = express()
const port = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

const storedAccounts = []

app.post('/api/store-key', (req, res) => {
  const { accountId, secretKey } = req.body ?? {}

  if (typeof accountId !== 'string' || typeof secretKey !== 'string') {
    return res.status(400).json({ error: 'accountId and secretKey are required strings.' })
  }

  if (!/^memdex\.[a-z0-9_-]+\.near$/.test(accountId)) {
    return res.status(400).json({ error: 'accountId must follow memdex.username.near format.' })
  }

  if (!secretKey.startsWith('ed25519:')) {
    return res.status(400).json({ error: 'secretKey must be an Ed25519 key.' })
  }

  // SECURITY NOTE (AES-256 for PostgreSQL persistence):
  // 1) Use a 32-byte key from a secure source (KMS/HSM or env var), never hardcode it.
  // 2) Encrypt secretKey before insert with AES-256-GCM (recommended for integrity):
  //    - Generate random 12-byte IV per record.
  //    - cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  //    - ciphertext = Buffer.concat([cipher.update(secretKey, 'utf8'), cipher.final()])
  //    - authTag = cipher.getAuthTag()
  // 3) Store ciphertext + iv + authTag in PostgreSQL columns (BYTEA/TEXT as needed).
  // 4) Keep encryption keys rotated and access-controlled; decrypt only when strictly needed.

  storedAccounts.push({
    accountId,
    secretKey,
    storedAt: new Date().toISOString(),
  })

  return res.status(201).json({ success: true, accountId })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, stored: storedAccounts.length })
})

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`)
})
