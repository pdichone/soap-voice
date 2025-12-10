interface PaymentLinkEmailParams {
  practitionerName: string;
  checkoutUrl: string;
  planName: string;
  planPrice: number;
  expiresAt: string;
}

export function generatePaymentLinkEmail(params: PaymentLinkEmailParams): {
  subject: string;
  html: string;
} {
  const { practitionerName, checkoutUrl, planName, planPrice, expiresAt } = params;

  const firstName = practitionerName.split(' ')[0] || 'there';
  const expiresDate = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const subject = `Complete Your ZenLeef ${planName} Plan Setup`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your ZenLeef Setup</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">
                <span style="color: #10b981;">Zen</span><span style="color: #f59e0b;">Leef</span>
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 40px 40px;">
              <h2 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1e293b;">
                Hi ${firstName}!
              </h2>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #475569;">
                Your ZenLeef account has been set up and is ready to go. Just one more step - complete your subscription to get full access to all features.
              </p>

              <!-- Plan Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
                            Your Plan
                          </p>
                          <p style="margin: 0; font-size: 20px; font-weight: 600; color: #1e293b;">
                            ${planName}
                          </p>
                        </td>
                        <td style="text-align: right;">
                          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #10b981;">
                            $${planPrice}
                          </p>
                          <p style="margin: 0; font-size: 14px; color: #64748b;">
                            per month
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding-bottom: 24px;">
                    <a href="${checkoutUrl}" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #10b981; text-decoration: none; border-radius: 8px;">
                      Complete Your Subscription
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #64748b; text-align: center;">
                This link will expire on ${expiresDate}
              </p>

              <!-- Features List -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
                      What's included:
                    </p>
                    <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 14px; line-height: 28px;">
                      <li>Patient management</li>
                      <li>Visit tracking</li>
                      <li>Referral tracking</li>
                      <li>Insurance claims tracking</li>
                      <li>Payment tracking</li>
                      <li>PDF exports</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 13px; color: #94a3b8; text-align: center;">
                Questions? Reply to this email or contact us at support@zenleef.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return { subject, html };
}
