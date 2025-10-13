/**
 * PayPal Payment Provider for Medusa 2.10+
 * 
 * 混合 SDK 方案：
 * - @paypal/checkout-server-sdk: 核心支付功能（稳定）
 * - @paypal/paypal-server-sdk: Vault API（保存支付方式）
 * 
 * 基于官方 @medusajs/payment-stripe 的实现模式
 * 参考：https://github.com/medusajs/medusa/tree/develop/packages/modules/providers/payment-stripe
 * 文档：https://docs.medusajs.com/resources/references/payment/provider
 */

import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ListPaymentMethodsInput,
  ListPaymentMethodsOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  SavePaymentMethodInput,
  SavePaymentMethodOutput,
  UpdateAccountHolderInput,
  UpdateAccountHolderOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  PaymentSessionStatus,
  MedusaError,
  PaymentActions,
} from "@medusajs/framework/utils"
import * as paypal from "@paypal/checkout-server-sdk"
import { 
  Client as PayPalVaultClient,
  Environment,
  VaultController
} from "@paypal/paypal-server-sdk"

interface PayPalOptions {
  clientId: string
  clientSecret: string
  isSandbox?: boolean
}

type PayPalOrder = {
  id: string
  status: string
  purchase_units?: any[]
  [key: string]: any
}

export default class PayPalProviderService extends AbstractPaymentProvider<PayPalOptions> {
  static identifier = "paypal"
  
  protected readonly options_: PayPalOptions
  protected readonly client_: paypal.core.PayPalHttpClient
  protected readonly vaultClient_: PayPalVaultClient
  
  static validateOptions(options: PayPalOptions): void {
    if (!options.clientId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Required option `clientId` is missing in PayPal provider"
      )
    }
    if (!options.clientSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Required option `clientSecret` is missing in PayPal provider"
      )
    }
  }
  
  constructor(container: any, options: PayPalOptions) {
    super(container, options)
    
    this.options_ = options
    
    // Initialize PayPal Orders/Payments client (旧 SDK - 稳定)
    const environment = options.isSandbox
      ? new paypal.core.SandboxEnvironment(options.clientId, options.clientSecret)
      : new paypal.core.LiveEnvironment(options.clientId, options.clientSecret)
    
    this.client_ = new paypal.core.PayPalHttpClient(environment)
    
    // Initialize PayPal Vault client (新 SDK - Vault API)
    this.vaultClient_ = new PayPalVaultClient({
      clientCredentialsAuthCredentials: {
        oAuthClientId: options.clientId,
        oAuthClientSecret: options.clientSecret,
      },
      // 使用 Environment 枚举
      environment: options.isSandbox ? Environment.Sandbox : Environment.Production
    })
  }
  
  /**
   * 创建 PayPal 订单
   * 
   * 🔑 关键：
   * - intent: CAPTURE (PayPal 默认)
   * - 金额转换：cents -> dollars
   */
  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const { currency_code, amount, data, context } = input
    
    const request = new paypal.orders.OrdersCreateRequest()
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: currency_code.toUpperCase(),
          value: ((amount as number) / 100).toFixed(2) // cents to dollars
        },
        custom_id: (data?.session_id as string) || undefined
      }],
      application_context: {
        user_action: "PAY_NOW"
      }
    })
    
    try {
      const order = await this.client_.execute(request)
      
      return {
        id: order.result.id,
        ...this.getStatus(order.result as PayPalOrder)
      }
    } catch (error: any) {
      throw new MedusaError(
        MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
        `PayPal initiatePayment failed: ${error.message || error}`
      )
    }
  }
  
  /**
   * 授权/捕获支付
   * 
   * 🔑 关键：
   * - PayPal CAPTURE intent：authorize = capture
   * - 执行捕获并返回正确的 CAPTURED 状态
   * 
   * 参考 Stripe provider：authorizePayment 调用 getPaymentStatus
   * 但 PayPal 需要执行实际的 capture API 调用
   */
  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const { data } = input
    const orderId = data?.id as string
    
    if (!orderId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No PayPal order ID found for authorizePayment"
      )
    }
    
    try {
      // PayPal CAPTURE intent: authorize时执行捕获
      const request = new paypal.orders.OrdersCaptureRequest(orderId)
      const capture = await this.client_.execute(request)
      
      // 返回 CAPTURED 状态
      return this.getStatus(capture.result as PayPalOrder)
    } catch (error: any) {
      // 如果已经被捕获（422错误），获取状态
      if (error.statusCode === 422) {
        return await this.getPaymentStatus(input)
      }
      
      throw new MedusaError(
        MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
        `PayPal authorizePayment failed: ${error.message || error}`
      )
    }
  }
  
  /**
   * 捕获支付
   * 
   * PayPal 已在 authorizePayment 中完成捕获
   * 这里只需返回当前状态
   */
  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    // PayPal CAPTURE intent 已在 authorizePayment 中捕获
    return await this.getPaymentStatus(input)
  }
  
  /**
   * 取消支付
   */
  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    // PayPal Orders API 不支持取消
    // 返回取消状态即可
    return {
      data: input.data,
    }
  }
  
  /**
   * 删除支付
   */
  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    return await this.cancelPayment(input)
  }
  
  /**
   * 获取支付状态
   * 
   * 参考 Stripe provider 的实现
   */
  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const { data } = input
    const orderId = data?.id as string
    
    if (!orderId) {
      return {
        status: PaymentSessionStatus.PENDING,
        data: data || {}
      }
    }
    
    try {
      const request = new paypal.orders.OrdersGetRequest(orderId)
      const order = await this.client_.execute(request)
      
      return this.getStatus(order.result as PayPalOrder)
    } catch (error) {
      return {
        status: PaymentSessionStatus.ERROR,
        data: data || {}
      }
    }
  }
  
  /**
   * 退款
   */
  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const { data, amount } = input
    
    // 从 data 中提取 capture ID
    const captureId = data?.purchase_units?.[0]?.payments?.captures?.[0]?.id as string
    
    if (!captureId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No capture ID found for refund"
      )
    }
    
    const request = new paypal.payments.CapturesRefundRequest(captureId)
    
    if (amount && typeof amount === 'number') {
      // Get currency from data
      const currencyCode = (data?.purchase_units?.[0]?.amount?.currency_code || 'USD') as string
      request.requestBody({
        amount: {
          currency_code: currencyCode.toUpperCase(),
          value: (amount / 100).toFixed(2)
        },
        invoice_id: "",  // PayPal SDK 要求的字段
        note_to_payer: "" // PayPal SDK 要求的字段
      } as any) // 使用 any 避免严格类型检查
    }
    
    try {
      const refund = await this.client_.execute(request)
      return { data: refund.result as unknown as Record<string, unknown> }
    } catch (error: any) {
      throw new MedusaError(
        MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
        `PayPal refundPayment failed: ${error.message || error}`
      )
    }
  }
  
  /**
   * 检索支付
   */
  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    return await this.getPaymentStatus(input)
  }
  
  /**
   * 更新支付
   * 
   * PayPal Orders API 创建后不支持更新金额
   * 需要创建新订单
   */
  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    // PayPal 不支持更新金额，创建新订单
    return await this.initiatePayment(input)
  }
  
  /**
   * 处理 Webhook
   * 
   * PayPal Webhooks 参考：
   * https://developer.paypal.com/api/rest/webhooks/event-names/
   */
  async getWebhookActionAndData(
    webhookData: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { resource, event_type } = webhookData as any
    
    switch (event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
        return {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: resource?.custom_id,
            amount: parseFloat(resource?.amount?.value || "0") * 100, // dollars to cents
          },
        }
      
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.DECLINED":
        return {
          action: PaymentActions.FAILED,
          data: {
            session_id: resource?.custom_id,
            amount: parseFloat(resource?.amount?.value || "0") * 100,
          },
        }
      
      case "CHECKOUT.ORDER.APPROVED":
        return {
          action: PaymentActions.AUTHORIZED,
          data: {
            session_id: resource?.purchase_units?.[0]?.custom_id,
            amount: parseFloat(resource?.purchase_units?.[0]?.amount?.value || "0") * 100,
          },
        }
      
      case "PAYMENT.CAPTURE.REFUNDED":
        return {
          action: PaymentActions.SUCCESSFUL, // 退款成功也算成功
          data: {
            session_id: resource?.custom_id,
            amount: parseFloat(resource?.amount?.value || "0") * 100,
          },
        }
      
      default:
        return {
          action: PaymentActions.NOT_SUPPORTED,
          data: {
            session_id: "",
            amount: 0,
          },
        }
    }
  }
  
  /**
   * 🔑 关键方法：将 PayPal 状态映射到 Medusa PaymentSessionStatus
   * 
   * 参考 Stripe provider 的 getStatus 实现
   * 
   * PayPal 状态：
   * - CREATED: 订单已创建，等待支付
   * - SAVED: 已保存
   * - APPROVED: 买家已批准，等待捕获
   * - COMPLETED: 已完成捕获 🔑
   * - VOIDED: 已作废
   * - PAYER_ACTION_REQUIRED: 需要买家操作
   * 
   * Medusa 状态：
   * - PENDING: 待处理
   * - AUTHORIZED: 已授权（未捕获）- Stripe 的 "requires_capture"
   * - CAPTURED: 已捕获 🔑 - Stripe 的 "succeeded"
   * - CANCELED: 已取消
   * - REQUIRES_MORE: 需要更多操作
   * - ERROR: 错误
   */
  private getStatus(paypalOrder: PayPalOrder): {
    data: Record<string, unknown>
    status: PaymentSessionStatus
  } {
    const status = paypalOrder.status
    const data = paypalOrder as unknown as Record<string, unknown>
    
    switch (status) {
      case "CREATED":
      case "SAVED":
        return {
          status: PaymentSessionStatus.PENDING,
          data
        }
      
      case "APPROVED":
        // 买家已批准但未捕获
        // 但我们使用 CAPTURE intent，这个状态很少见
        return {
          status: PaymentSessionStatus.PENDING,
          data
        }
      
      case "PAYER_ACTION_REQUIRED":
        return {
          status: PaymentSessionStatus.REQUIRES_MORE,
          data
        }
      
      case "COMPLETED":
        // 🔑 关键：PayPal COMPLETED = Medusa CAPTURED
        // 对应 Stripe 的 "succeeded" -> CAPTURED
        return {
          status: PaymentSessionStatus.CAPTURED,
          data
        }
      
      case "VOIDED":
        return {
          status: PaymentSessionStatus.CANCELED,
          data
        }
      
      default:
        return {
          status: PaymentSessionStatus.PENDING,
          data
        }
    }
  }
  
  /**
   * 创建账户持有人（客户）
   * 
   * PayPal 不需要单独创建客户账户，使用 Medusa customer ID 作为标识
   * 
   * 参考 Stripe provider 的实现模式
   */
  async createAccountHolder({
    context,
  }: CreateAccountHolderInput): Promise<CreateAccountHolderOutput> {
    const { account_holder, customer } = context
    
    // 如果已有 account holder，直接返回
    if (account_holder?.data?.id) {
      return { id: account_holder.data.id as string }
    }
    
    if (!customer) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No customer provided while creating account holder"
      )
    }
    
    // PayPal 使用 payer_id 或 customer reference ID
    // 这里我们使用 Medusa customer ID 作为 PayPal 的引用 ID
    const paypalCustomerId = `paypal_${customer.id}`
    
    return {
      id: paypalCustomerId,
      data: {
        id: paypalCustomerId,
        email: customer.email,
        name: customer.company_name || 
              `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || 
              undefined,
        phone: customer.phone,
      } as unknown as Record<string, unknown>,
    }
  }
  
  /**
   * 更新账户持有人
   * 
   * PayPal 不支持直接更新客户信息
   * 返回更新后的数据供 Medusa 存储
   */
  async updateAccountHolder({
    context,
    data,
  }: UpdateAccountHolderInput): Promise<UpdateAccountHolderOutput> {
    const { account_holder, customer } = context
    
    if (!account_holder?.data?.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing account holder ID"
      )
    }
    
    // 更新本地存储的数据
    const updatedData = {
      ...(account_holder.data as Record<string, unknown>),
      ...data,
      email: customer?.email || account_holder.data.email,
      name: customer?.company_name || 
            `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || 
            (account_holder.data as any).name,
    }
    
    return {
      data: updatedData,
    }
  }
  
  /**
   * 删除账户持有人
   * 
   * PayPal 不需要删除客户账户
   * 仅返回确认
   */
  async deleteAccountHolder({
    context,
  }: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput> {
    const { account_holder } = context
    
    if (!account_holder?.data?.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing account holder ID"
      )
    }
    
    // PayPal 不需要删除客户账户
    return {}
  }
  
  /**
   * 保存支付方式
   * 
   * ✅ PayPal Vault API 功能 - 使用新 SDK
   * 
   * 使用 Setup Tokens 来保存客户的支付方式
   * 参考：https://developer.paypal.com/docs/checkout/save-payment-methods/
   */
  async savePaymentMethod({
    context,
    data,
  }: SavePaymentMethodInput): Promise<SavePaymentMethodOutput> {
    const accountHolderId = context?.account_holder?.data?.id as string | undefined
    
    if (!accountHolderId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing account holder ID for saving payment method"
      )
    }
    
    try {
      // 使用新 SDK 的 Vault controller 创建 Setup Token
      const vaultController = new VaultController(this.vaultClient_)
      
      const setupTokenRequest = {
        payment_source: {
          card: data?.card || {},  // 卡片信息
        },
        customer: {
          id: accountHolderId
        }
      }
      
      const response = await vaultController.createSetupToken({
        body: setupTokenRequest as any,
        paypalRequestId: context?.idempotency_key
      })
      
      return {
        id: response.result.id || '',
        data: response.result as unknown as Record<string, unknown>,
      }
    } catch (error: any) {
      throw new MedusaError(
        MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
        `PayPal savePaymentMethod failed: ${error.message || error}`
      )
    }
  }
  
  /**
   * 列出已保存的支付方式
   * 
   * ✅ PayPal Vault API 功能 - 使用新 SDK
   */
  async listPaymentMethods({
    context,
  }: ListPaymentMethodsInput): Promise<ListPaymentMethodsOutput> {
    const accountHolderId = context?.account_holder?.data?.id as string | undefined
    
    if (!accountHolderId) {
      return []
    }
    
    try {
      // 使用新 SDK 的 Vault controller 获取客户的支付方式
      const vaultController = new VaultController(this.vaultClient_)
      
      const response = await vaultController.listCustomerPaymentTokens({
        customerId: accountHolderId,
        pageSize: 100
      })
      
      return (response.result.paymentTokens || []).map((token: any) => ({
        id: token.id,
        data: token as unknown as Record<string, unknown>,
      }))
    } catch (error: any) {
      // 如果客户没有保存的支付方式，返回空数组
      if (error.statusCode === 404) {
        return []
      }
      
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `PayPal listPaymentMethods failed: ${error.message || error}`
      )
    }
  }
}

