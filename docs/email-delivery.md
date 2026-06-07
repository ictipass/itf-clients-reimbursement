# Transactional Email Delivery

The reimbursement app sends transactional email through Resend's HTTPS API. No additional Node
package is required.

## Delivery Modes

- `development_link`: do not send email; expose generated links in development UI.
- `resend_and_development_link`: send through Resend and expose links for local testing.
- `resend`: send through Resend and never expose private links in the UI. Production requires this
  mode.

Required Resend settings:

```env
EMAIL_DELIVERY_MODE="resend_and_development_link"
RESEND_API_KEY="re_..."
EMAIL_FROM="ITF Reimbursement <onboarding@resend.dev>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Use `onboarding@resend.dev` only during Resend testing. Before production, verify the ITF sending
domain in Resend and replace `EMAIL_FROM` with an address on that domain.

Email verification and employer organization invitations use this adapter. Private verification
and invitation links are shown in the UI only when a development-link mode is selected.
