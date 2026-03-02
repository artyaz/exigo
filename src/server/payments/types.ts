export interface CheckoutResult {
  url: string;
  transactionId: string;
}

export interface IPaymentProvider {
  /**
   * Create a hosted checkout session and return the redirect URL.
   * @param userId - The Clerk user ID to associate with this checkout
   * @param priceId - The provider-specific price identifier
   */
  createCheckout(
    userId: string,
    priceId: string,
  ): Promise<CheckoutResult>;

  /**
   * Verify the authenticity of an incoming webhook request.
   * @param rawBody - The raw request body (string or Buffer)
   * @param signature - The webhook signature header value
   */
  verifyWebhook(rawBody: string | Buffer, signature: string): boolean;

  /**
   * Cancel an active subscription.
   * @param subscriptionId - The provider-specific subscription identifier
   */
  cancelSubscription(subscriptionId: string): Promise<void>;
}
