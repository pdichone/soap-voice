// Payment Links - Admin-generated Stripe checkout sessions

export type PaymentLinkStatus = 'pending' | 'completed' | 'expired';
export type PlanType = 'founder' | 'solo';

export interface PaymentLink {
  id: string;
  practitioner_id: string;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
  plan_type: PlanType;
  checkout_url: string;
  status: PaymentLinkStatus;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}

// API Request/Response types for payment link generation
export interface GeneratePaymentLinkRequest {
  plan_type: PlanType;
  trial_days?: number;
}

export interface GeneratePaymentLinkResponse {
  payment_link: PaymentLink;
  checkout_url: string;
}

export interface PaymentLinksResponse {
  payment_links: PaymentLink[];
}

// API Request/Response types for sending payment email
export interface SendPaymentEmailRequest {
  payment_link_id: string;
}

export interface SendPaymentEmailResponse {
  success: boolean;
  message: string;
}

// Billing status for practitioners
export type BillingStatus = 'trial' | 'paying' | 'overdue' | 'cancelled' | 'none';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | null;

// Props for BillingSection component
export interface BillingSectionProps {
  practitionerId: string;
  practitionerEmail: string;
  practitionerName: string;
  planType: string | null;
  billingStatus: BillingStatus | string | null;
  subscriptionStatus: SubscriptionStatus | string | null;
  monthlyPrice: number | null;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}
