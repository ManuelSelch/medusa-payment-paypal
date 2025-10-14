# Medusa Payment PayPal

Complete PayPal Payment Provider for Medusa v2.10+ with full Vault API support.

## ✨ Features

### Core Payment Capabilities
- ✅ Order creation (Orders API)
- ✅ Payment authorization and capture
- ✅ Refund processing
- ✅ Webhook integration
- ✅ Sandbox and production environment support

### Advanced Features (Vault API)
- ✅ **Save Payment Methods** - Customers can save credit cards for faster checkout
- ✅ **List Payment Methods** - View saved payment methods
- ✅ **Customer Account Management** - Create, update, delete customer accounts
- ✅ **Setup Tokens** - Securely collect and store payment information

### Technical Highlights
- ✨ **Unified SDK** - Implements all features using the latest `@paypal/paypal-server-sdk`
- 📝 **Full TypeScript support**
- 🛡️ **Error handling and validation**
- 🎯 **Based on official Stripe provider implementation pattern**
- 🚀 **Actively maintained** - Follows PayPal's latest SDK updates

## 📦 Installation

```bash
npm install @rd1988/medusa-payment-paypal
# or
yarn add @rd1988/medusa-payment-paypal
```

## 🚀 Usage

### 1. Configure Medusa

Add the provider in `medusa-config.ts`:

```typescript
import { defineConfig } from "@medusajs/framework/utils"

export default defineConfig({
  // ...
  modules: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@rd1988/medusa-payment-paypal",
            id: "paypal",
            options: {
              clientId: process.env.PAYPAL_CLIENT_ID,
              clientSecret: process.env.PAYPAL_CLIENT_SECRET,
              isSandbox: process.env.PAYPAL_IS_SANDBOX === "true",
            },
          },
        ],
      },
    },
  ],
})
```

### 2. Environment Variables

Create a `.env` file:

```bash
# PayPal Sandbox Environment
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_IS_SANDBOX=true

# PayPal Production Environment
# PAYPAL_CLIENT_ID=your_production_client_id
# PAYPAL_CLIENT_SECRET=your_production_client_secret
# PAYPAL_IS_SANDBOX=false
```

### 3. Get PayPal Credentials

1. Visit [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create an app to get Client ID and Secret
3. Configure sandbox test accounts

### 4. Enable in Admin

1. Log in to Medusa Admin
2. Go to Settings → Regions
3. Enable PayPal payment provider for your region

## 🔧 Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | string | ✅ | PayPal Client ID |
| `clientSecret` | string | ✅ | PayPal Client Secret |
| `isSandbox` | boolean | ❌ | Use sandbox environment (default `false`) |

## 📝 Supported Methods

### Core Payment
- `initiatePayment` - Create PayPal order
- `authorizePayment` - Authorize and capture payment
- `capturePayment` - Capture authorized payment
- `cancelPayment` - Cancel payment
- `refundPayment` - Process refund
- `retrievePayment` - Get payment status
- `updatePayment` - Update payment (recreate order)
- `getWebhookActionAndData` - Handle PayPal webhooks

### Account Management
- `createAccountHolder` - Create customer account
- `updateAccountHolder` - Update customer information
- `deleteAccountHolder` - Delete customer account

### Payment Method Management (Vault API)
- `savePaymentMethod` - Save customer payment method
- `listPaymentMethods` - List saved payment methods

## 🎨 Frontend Integration

### Basic Payment Flow

```typescript
// In checkout page
import { sdk } from "@/lib/medusa"

// 1. Initialize PayPal payment session
const paymentSession = await sdk.store.payment.initiatePaymentSession(cartId, {
  provider_id: "pp_payment_paypal", // pp_{module_id}_{identifier}
})

// 2. Load PayPal SDK
const script = document.createElement('script')
script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture`
script.onload = () => {
  window.paypal.Buttons({
    createOrder: () => paymentSession.data.id, // Use Medusa-created order ID
    onApprove: async () => {
      // 3. Complete order
      const order = await sdk.store.cart.complete(cartId)
      // Redirect to order confirmation page
    }
  }).render('#paypal-button-container')
}
document.body.appendChild(script)
```

### Save Payment Method (Optional)

```typescript
// Save customer payment method
const paymentMethod = await sdk.store.payment.savePaymentMethod({
  provider_id: "pp_payment_paypal",
  data: {
    card: {
      // Card information
    }
  }
})

// List saved payment methods
const paymentMethods = await sdk.store.payment.listPaymentMethods()
```

## 🔍 Status Mapping

| PayPal Status | Medusa Status | Description |
|--------------|--------------|-------------|
| `CREATED` | `PENDING` | Order created |
| `SAVED` | `PENDING` | Order saved |
| `APPROVED` | `PENDING` | Buyer approved |
| `COMPLETED` | `CAPTURED` | 🔑 Payment completed |
| `VOIDED` | `CANCELED` | Payment voided |
| `PAYER_ACTION_REQUIRED` | `REQUIRES_MORE` | Requires buyer action |

## 🐛 Troubleshooting

### Payment status not updating

Ensure PayPal status is correctly mapped to Medusa's `CAPTURED` status. This provider handles this correctly.

### Amount format errors

PayPal uses dollars, Medusa uses cents. This provider handles conversion automatically:
- Sending to PayPal: `3299 cents → $32.99`
- Receiving from PayPal: `$32.99 → 3299 cents`

### Vault API unavailable

PayPal Vault API is currently **only available in the United States**. Ensure your PayPal account supports this feature.

## 📚 Reference Documentation

- [PayPal Orders API](https://developer.paypal.com/docs/api/orders/v2/)
- [PayPal Payments API](https://developer.paypal.com/docs/api/payments/v2/)
- [PayPal Vault API](https://developer.paypal.com/docs/api/payment-tokens/v3/)
- [Medusa Payment Provider](https://docs.medusajs.com/resources/references/payment/provider)

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

MIT License

## 🙏 Acknowledgments

Based on the implementation pattern of the official [@medusajs/payment-stripe](https://github.com/medusajs/medusa/tree/develop/packages/modules/providers/payment-stripe).
