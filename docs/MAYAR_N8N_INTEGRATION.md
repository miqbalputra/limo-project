# Mayar and n8n Payment Integration

LIMO uses Mayar Headless API V2 for Wali invoice payment links. The local `Tagihan` record remains the source of truth; Mayar only provides the checkout link and payment event.

## Mayar

- Production base URL: `https://api.mayar.id/hl/v2`
- Sandbox base URL: `https://api.mayar.io/hl/v2`
- Create invoice: `POST /invoices/create`
- LIMO endpoint: `POST /api/v1/tagihan/{tagihanId}/payment`
- Webhook endpoint: `POST /api/v1/webhooks/mayar?secret=<MAYAR_WEBHOOK_SECRET>`
- Reconciliation command: `npm run mayar:reconcile -- --dry-run`
- Wali success page: `/wali/tagihan/success?tagihanId=<id>`

Configure the Mayar dashboard webhook URL with the public LIMO webhook URL. Mayar documents `payment.received`; LIMO also stores the Mayar invoice/transaction IDs and uses `extraData.tagihanId` for local mapping.

Required production variables:

```env
MAYAR_ENV=production
MAYAR_API_KEY=replace-with-mayar-api-key
MAYAR_MERCHANT_ID=replace-with-mayar-merchant-id
MAYAR_WEBHOOK_SECRET=replace-with-random-secret
```

The API key is sent only as a Bearer token from the server. Never expose it to browser code.

After a Mayar link is created, the Wali payment panel polls the authorized local tagihan endpoint every five seconds. It shows a success alert and links to the success page only after the local status is `PAID`; the browser never marks an invoice paid by itself.

The reconciliation job reads pending invoice IDs from LIMO and checks their status through Mayar's invoice detail endpoint. Run it from a scheduler with `npm run mayar:reconcile`; use `--dry-run` for a read-only check.

## n8n Email and WhatsApp

Set `NOTIFICATION_PROVIDER=n8n`. LIMO creates notification records for the Wali email and Wali phone, then the retry job posts them to separate n8n webhooks:

```env
N8N_EMAIL_WEBHOOK_URL=https://n8n.example.com/webhook/limo-email
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.example.com/webhook/limo-whatsapp
N8N_WEBHOOK_SECRET=replace-with-random-secret
```

Each webhook receives:

```json
{
  "event": "limo.notification",
  "notificationId": "...",
  "channel": "email|whatsapp",
  "recipient": "email-or-phone",
  "subject": "...",
  "body": "...",
  "metadata": {
    "tagihanId": "...",
    "provider": "mayar"
  }
}
```

LIMO sends `X-Limo-Webhook-Secret`. n8n must validate it before forwarding email or GOWA WhatsApp messages, and return a 2xx response only after accepting the event. The existing notification retry job handles failed webhook delivery and attempt limits.
