# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-13

### Added
- 🎉 Initial release
- ✅ Complete PayPal payment integration for Medusa v2.10+
- ✅ Core payment functionality
  - Create orders
  - Authorize and capture payments
  - Refund handling
  - Webhook integration
- ✅ Vault API support (US only)
  - Save payment methods using Setup Tokens
  - List saved payment methods
- ✅ Account holder management
  - Create customer accounts
  - Update customer information
  - Delete customer accounts
- ✅ Hybrid SDK approach
  - `@paypal/checkout-server-sdk` for core payments
  - `@paypal/paypal-server-sdk` for Vault API
- ✅ Proper status mapping (PayPal COMPLETED → Medusa CAPTURED)
- ✅ Automatic amount conversion (cents ↔ dollars)
- ✅ TypeScript support
- ✅ Sandbox and production environment support

### Technical Details
- Based on official @medusajs/payment-stripe implementation pattern
- Full TypeScript type definitions
- Comprehensive error handling
- Follows Medusa v2 payment provider specification

### Documentation
- Complete README with setup instructions
- API reference
- Frontend integration guide
- Troubleshooting section

[1.0.0]: https://github.com/yourusername/medusa-payment-paypal/releases/tag/v1.0.0

