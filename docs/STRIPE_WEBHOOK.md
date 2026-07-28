# Wiring Stripe webhook and setting the GitHub secret

This document explains how to configure Stripe to send webhook events to your deployed backend and how to save the webhook secret into your repository using the `gh` CLI helper.

1. Create the webhook endpoint in Stripe

- Go to the Stripe Dashboard → Developers → Webhooks → Add endpoint
- Set the endpoint to: `https://<YOUR_BACKEND_HOST>/api/webhook` (for example `https://api.cbat-academy.com/api/webhook`)
- Subscribe to events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and any others you want.
- Click Create and copy the webhook signing secret (starts with `whsec_...`).

2. Save the webhook secret to GitHub Actions secrets

You can use the included helper script `scripts/set_github_secret.sh` to push the secret into your repository secrets (requires `gh` CLI authenticated with appropriate permissions):

```bash
# example usage
./scripts/set_github_secret.sh STRIPE_WEBHOOK_SECRET "whsec_..."
```

The script will call `gh secret set` and store the secret in the repository. Alternatively set the secret manually in GitHub -> Settings -> Secrets -> Actions.

3. Add keys to your Render (or other) environment

- Add `STRIPE_API_KEY` (sk_live_...) and `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` to your Render environment variables for the backend service.

Security note: Never commit secret values to the repo. Use GitHub or your hosting provider's environment secret management.
