import { createMockPaymentLinksApi, createSeedLinks } from './features/payment-links/api/paymentLinksApi'
import { PaymentLinksPage } from './features/payment-links/components/PaymentLinksPage'

// Persisted to localStorage so links survive a reload (falls back to in-memory if storage is blocked).
const api = createMockPaymentLinksApi({ latencyMs: 400, seed: createSeedLinks(new Date()), storage: getStorage() })

// Manual check of the error state: open the app with ?fail=1 to make the first load fail.
if (new URLSearchParams(window.location.search).has('fail')) api.failNextRequest()

function getStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function App() {
  return <PaymentLinksPage api={api} />
}

export default App
