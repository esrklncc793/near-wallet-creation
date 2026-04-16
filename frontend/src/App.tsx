import { useEffect, useMemo, useState } from 'react'
import * as nearApi from 'near-api-js/lib/browser-index'
import { setupWalletSelector, type WalletSelector } from '@near-wallet-selector/core'
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui'
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet'
import '@near-wallet-selector/modal-ui/styles.css'
import './App.css'

const NETWORK = import.meta.env.VITE_NEAR_NETWORK ?? 'testnet'
const CONTRACT_ID = import.meta.env.VITE_NEAR_CONTRACT_ID ?? 'memdex.near'
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001'


function toSelectorAction(action: nearApi.transactions.Action) {
  switch (action.enum) {
    case 'createAccount':
      return { type: 'CreateAccount' as const }
    case 'transfer':
      return {
        type: 'Transfer' as const,
        params: { deposit: action.transfer!.deposit.toString() },
      }
    case 'addKey':
      return {
        type: 'AddKey' as const,
        params: {
          publicKey: action.addKey!.publicKey.toString(),
          accessKey: { permission: 'FullAccess' as const },
        },
      }
    default:
      throw new Error(`Unsupported near-api-js action: ${action.enum}`)
  }
}

function App() {
  const [selector, setSelector] = useState<WalletSelector | null>(null)
  const [modal, setModal] = useState<WalletSelectorModal | null>(null)
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [createdAccountId, setCreatedAccountId] = useState('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const initializedSelector = await setupWalletSelector({
        network: NETWORK,
        modules: [setupMyNearWallet()],
      })

      const initializedModal = setupModal(initializedSelector, {
        contractId: CONTRACT_ID,
      })

      if (!mounted) {
        return
      }

      setSelector(initializedSelector)
      setModal(initializedModal)

      const currentState = initializedSelector.store.getState()
      const currentAccount =
        currentState.accounts.find((account) => account.active)?.accountId ??
        currentState.accounts[0]?.accountId ??
        null
      setActiveAccountId(currentAccount)

      initializedSelector.store.observable.subscribe((nextState) => {
        const selectedAccount =
          nextState.accounts.find((account) => account.active)?.accountId ??
          nextState.accounts[0]?.accountId ??
          null
        setActiveAccountId(selectedAccount)
      })
    }

    void init()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!activeAccountId) {
      return
    }

    const inferredUserId = activeAccountId.split('.')[0] ?? ''
    setUserId((currentUserId) => currentUserId || inferredUserId)
  }, [activeAccountId])

  const connectLabel = useMemo(
    () => (activeAccountId ? `Connected: ${activeAccountId}` : 'Connect Wallet'),
    [activeAccountId],
  )

  const handleConnectWallet = async () => {
    if (!selector || !modal) {
      return
    }

    if (!activeAccountId) {
      modal.show()
      return
    }

    const wallet = await selector.wallet()
    await wallet.signOut()
    setActiveAccountId(null)
    setStatus('Wallet disconnected.')
  }

  const handleCreateSubAccount = async () => {
    if (!selector || !activeAccountId) {
      setStatus('Connect a wallet first.')
      return
    }

    const normalizedUserId = userId.trim().toLowerCase()
    if (!/^[a-z0-9_-]+$/.test(normalizedUserId)) {
      setStatus('User ID must only include lowercase letters, numbers, hyphens, and underscores.')
      return
    }

    const subAccountId = `memdex.${normalizedUserId}.near`

    setIsSubmitting(true)
    setStatus(`Creating ${subAccountId}...`)

    try {
      const keyPair = nearApi.utils.KeyPair.fromRandom('ed25519')
      const publicKey = nearApi.utils.PublicKey.from(keyPair.getPublicKey().toString())

      const transferAmount = nearApi.utils.format.parseNearAmount('0.1')
      if (!transferAmount) {
        throw new Error('Failed to parse transfer amount for storage staking.')
      }

      const nearActions = [
        nearApi.transactions.createAccount(),
        nearApi.transactions.transfer(BigInt(transferAmount)),
        nearApi.transactions.addKey(publicKey, nearApi.transactions.fullAccessKey()),
      ]

      const walletActions = nearActions.map(toSelectorAction)

      const wallet = await selector.wallet()
      await wallet.signAndSendTransaction({
        signerId: activeAccountId,
        receiverId: subAccountId,
        actions: walletActions as unknown as Parameters<typeof wallet.signAndSendTransaction>[0]['actions'],
      })

      const response = await fetch(`${BACKEND_URL}/api/store-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: subAccountId,
          secretKey: keyPair.toString(),
        }),
      })

      if (!response.ok) {
        throw new Error(`Backend failed with status ${response.status}.`)
      }

      setCreatedAccountId(subAccountId)
      setStatus(`Created and stored key for ${subAccountId}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.'
      setStatus(`Failed: ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app">
      <h1>NEAR Wallet Sub-account Creator</h1>
      <button type="button" onClick={() => void handleConnectWallet()} className="connect">
        {connectLabel}
      </button>

      <label htmlFor="user-id">User ID</label>
      <input
        id="user-id"
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
        placeholder="username"
        autoComplete="off"
      />

      <p className="hint">Sub-account format: memdex.username.near</p>

      <button
        type="button"
        onClick={() => void handleCreateSubAccount()}
        disabled={!activeAccountId || isSubmitting}
      >
        {isSubmitting ? 'Submitting transaction...' : 'Create memdex sub-account'}
      </button>

      {status && <p role="status">{status}</p>}
      {createdAccountId && <p className="created">Created account: {createdAccountId}</p>}
    </main>
  )
}

export default App
