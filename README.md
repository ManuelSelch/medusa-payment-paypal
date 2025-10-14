# Medusa Payment PayPal

完整的 PayPal Payment Provider for Medusa v2.10+，支持 Vault API（保存支付方式）。

## ✨ 特性

### 核心支付功能
- ✅ 创建订单 (Orders API)
- ✅ 支付授权和捕获
- ✅ 退款处理
- ✅ Webhook 集成
- ✅ 沙箱和生产环境支持

### 高级功能 (Vault API)
- ✅ **保存支付方式** - 客户可以保存信用卡以便快速结账
- ✅ **列出支付方式** - 查看已保存的支付方式
- ✅ **客户账户管理** - 创建、更新、删除客户账户
- ✅ **Setup Tokens** - 安全地收集和存储支付信息

### 技术亮点
- ✨ **统一 SDK** - 使用最新的 `@paypal/paypal-server-sdk` 实现所有功能
- 📝 **完整的 TypeScript 类型支持**
- 🛡️ **错误处理和验证**
- 🎯 **基于官方 Stripe provider 的实现模式**
- 🚀 **持续维护** - 跟随 PayPal 官方最新 SDK 更新

## 📦 安装

```bash
npm install @rd1988/medusa-payment-paypal
# or
yarn add @rd1988/medusa-payment-paypal
```

## 🚀 使用

### 1. 配置 Medusa

在 `medusa-config.ts` 中添加 provider：

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

### 2. 环境变量

创建 `.env` 文件：

```bash
# PayPal 沙箱环境
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_IS_SANDBOX=true

# PayPal 生产环境
# PAYPAL_CLIENT_ID=your_production_client_id
# PAYPAL_CLIENT_SECRET=your_production_client_secret
# PAYPAL_IS_SANDBOX=false
```

### 3. 获取 PayPal 凭证

1. 访问 [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. 创建应用获取 Client ID 和 Secret
3. 配置沙箱测试账号

### 4. 在 Admin 中启用

1. 登录 Medusa Admin
2. 前往 Settings → Regions
3. 为对应的 region 启用 PayPal payment provider

## 🔧 配置选项

| 选项 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `clientId` | string | ✅ | PayPal Client ID |
| `clientSecret` | string | ✅ | PayPal Client Secret |
| `isSandbox` | boolean | ❌ | 是否使用沙箱环境（默认 `false`） |

## 📝 支持的方法

### 核心支付
- `initiatePayment` - 创建 PayPal 订单
- `authorizePayment` - 授权并捕获支付
- `capturePayment` - 捕获已授权的支付
- `cancelPayment` - 取消支付
- `refundPayment` - 退款
- `retrievePayment` - 获取支付状态
- `updatePayment` - 更新支付（重新创建订单）
- `getWebhookActionAndData` - 处理 PayPal Webhook

### 账户管理
- `createAccountHolder` - 创建客户账户
- `updateAccountHolder` - 更新客户信息
- `deleteAccountHolder` - 删除客户账户

### 支付方式管理 (Vault API)
- `savePaymentMethod` - 保存客户支付方式
- `listPaymentMethods` - 列出已保存的支付方式

## 🎨 前端集成

### 基础支付流程

```typescript
// 在结账页面
import { sdk } from "@/lib/medusa"

// 1. 初始化 PayPal 支付会话
const paymentSession = await sdk.store.payment.initiatePaymentSession(cartId, {
  provider_id: "pp_payment_paypal", // pp_{module_id}_{identifier}
})

// 2. 加载 PayPal SDK
const script = document.createElement('script')
script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture`
script.onload = () => {
  window.paypal.Buttons({
    createOrder: () => paymentSession.data.id, // 使用 Medusa 创建的订单 ID
    onApprove: async () => {
      // 3. 完成订单
      const order = await sdk.store.cart.complete(cartId)
      // 跳转到订单确认页
    }
  }).render('#paypal-button-container')
}
document.body.appendChild(script)
```

### 保存支付方式（可选）

```typescript
// 保存客户的支付方式
const paymentMethod = await sdk.store.payment.savePaymentMethod({
  provider_id: "pp_payment_paypal",
  data: {
    card: {
      // 卡片信息
    }
  }
})

// 列出已保存的支付方式
const paymentMethods = await sdk.store.payment.listPaymentMethods()
```

## 🔍 状态映射

| PayPal 状态 | Medusa 状态 | 说明 |
|------------|------------|------|
| `CREATED` | `PENDING` | 订单已创建 |
| `SAVED` | `PENDING` | 订单已保存 |
| `APPROVED` | `PENDING` | 买家已批准 |
| `COMPLETED` | `CAPTURED` | 🔑 支付已完成 |
| `VOIDED` | `CANCELED` | 支付已作废 |
| `PAYER_ACTION_REQUIRED` | `REQUIRES_MORE` | 需要买家操作 |

## 🐛 故障排除

### 支付状态不更新

确保 PayPal 状态正确映射为 Medusa 的 `CAPTURED` 状态。本 provider 已修复此问题。

### 金额格式错误

PayPal 使用美元（dollars），Medusa 使用美分（cents）。本 provider 自动处理转换：
- 发送给 PayPal: `3299 cents → $32.99`
- 从 PayPal 接收: `$32.99 → 3299 cents`

### Vault API 不可用

PayPal Vault API 目前**仅在美国可用**。确保你的 PayPal 账户支持此功能。

## 📚 参考文档

- [PayPal Orders API](https://developer.paypal.com/docs/api/orders/v2/)
- [PayPal Payments API](https://developer.paypal.com/docs/api/payments/v2/)
- [PayPal Vault API](https://developer.paypal.com/docs/api/payment-tokens/v3/)
- [Medusa Payment Provider](https://docs.medusajs.com/resources/references/payment/provider)

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

## 📄 许可

MIT License

## 🙏 致谢

基于官方 [@medusajs/payment-stripe](https://github.com/medusajs/medusa/tree/develop/packages/modules/providers/payment-stripe) 的实现模式。

