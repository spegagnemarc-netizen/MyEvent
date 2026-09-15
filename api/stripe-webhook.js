const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).send("Signature Stripe manquante");
  }

  try {
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;

      if (session.payment_status === "paid") {
        const fundEntryId =
          session.metadata?.fund_entry_id;

        if (fundEntryId) {
          const response = await fetch(
            `${SUPABASE_URL}/rest/v1/event_fund_entries?id=eq.${encodeURIComponent(fundEntryId)}`,
            {
              method: "PATCH",

              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization:
                  `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                Prefer: "return=minimal"
              },

              body: JSON.stringify({
                status: "confirmed"
              })
            }
          );

          if (!response.ok) {
            const text = await response.text();

            console.error(
              "Erreur Supabase:",
              text
            );

            return res.status(500).send(
              "Erreur lors de la confirmation Supabase"
            );
          }
        }
      }
    }

    return res.status(200).json({
      received: true
    });

  } catch (error) {
    console.error(
      "Stripe webhook error:",
      error
    );

    return res.status(400).send(
      `Webhook Error: ${error.message}`
    );
  }
};
