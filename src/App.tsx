import { createMockPaymentLinksApi, createSeedLinks } from './features/payment-links/api/paymentLinksApi'
import { PaymentLinksPage } from './features/payment-links/components/PaymentLinksPage'

const api = createMockPaymentLinksApi({ latencyMs: 400, seed: createSeedLinks(new Date()) })

// Manual check of the error state: open the app with ?fail=1 to make the first load fail.
if (new URLSearchParams(window.location.search).has('fail')) api.failNextRequest()

function App() {
  return <PaymentLinksPage api={api} />
}

export default App
