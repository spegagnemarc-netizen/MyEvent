const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      amount,
      currency = "eur",
      event_id,
      fund_entry_id,
      user_id
    } = req.body || {};

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        error: "Montant invalide"
      });
    }

    if (!event_id || !fund_entry_id || !user_id) {
      return res.status(400).json({
        error: "Informations de paiement manquantes"
      });
    }

    const amountCents = Math.round(Number(amount) * 100);

    if (amountCents < 50) {
      return res.status(400).json({
        error: "Le montant minimum est de 0,50 €"
      });
    }

    const origin =
      req.headers.origin ||
      `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      payment_method_types: ["card"],

      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: "Participation MyEvent"
            },
            unit_amount: amountCents
          },
          quantity: 1
        }
      ],

      metadata: {
        event_id: String(event_id),
        fund_entry_id: String(fund_entry_id),
        user_id: String(user_id)
      },

      success_url:
        `${origin}/?stripe_payment=success&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${origin}/?stripe_payment=cancelled`,

      customer_creation: "if_required"
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error("Stripe Checkout error:", error);

    return res.status(500).json({
      error: "Impossible de créer le paiement Stripe",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
};
