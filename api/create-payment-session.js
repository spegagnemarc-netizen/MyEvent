module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return res.status(500).json({
        error: "STRIPE_SECRET_KEY n'est pas configurée dans Vercel."
      });
    }

    const body = req.body || {};

    /*
     * Accepte plusieurs formats :
     * 66.67
     * "66.67"
     * "66,67"
     * "66,67 €"
     */
    let rawAmount =
      body.amount ??
      body.amount_eur ??
      body.amountEuros ??
      body.amountCents;

    if (rawAmount === undefined || rawAmount === null) {
      return res.status(400).json({
        error: "Montant manquant."
      });
    }

    let amountCents;

    // Si le frontend envoie déjà des centimes
    if (
      body.amountCents !== undefined &&
      body.amountCents !== null
    ) {
      amountCents = Math.round(Number(body.amountCents));
    } else {
      // Nettoyage d'un montant français
      let value = String(rawAmount)
        .trim()
        .replace(/\s/g, "")
        .replace("€", "")
        .replace(",", ".");

      value = Number(value);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          error: "Montant invalide."
        });
      }

      amountCents = Math.round(value * 100);
    }

    if (!Number.isInteger(amountCents) || amountCents < 50) {
      return res.status(400).json({
        error: "Montant invalide. Le montant minimum est de 0,50 €."
      });
    }

    const eventId = body.event_id || body.eventId || "";
    const fundEntryId =
      body.fund_entry_id ||
      body.fundEntryId ||
      "";

    const userId =
      body.user_id ||
      body.userId ||
      "";

    const origin =
      req.headers.origin ||
      "https://my-event-eosin.vercel.app";

    const successUrl =
      `${origin}/?stripe_payment=success` +
      `&event_id=${encodeURIComponent(eventId)}` +
      `&fund_entry_id=${encodeURIComponent(fundEntryId)}`;

    const cancelUrl =
      `${origin}/?stripe_payment=cancelled` +
      `&event_id=${encodeURIComponent(eventId)}` +
      `&fund_entry_id=${encodeURIComponent(fundEntryId)}`;

    /*
     * Création directe de la Checkout Session Stripe.
     *
     * On utilise l'API HTTP Stripe directement :
     * cela évite complètement l'erreur
     * "Cannot find module 'stripe'".
     */
    const params = new URLSearchParams();

    params.append(
      "mode",
      "payment"
    );

    params.append(
      "payment_method_types[0]",
      "card"
    );

    params.append(
      "line_items[0][price_data][currency]",
      "eur"
    );

    params.append(
      "line_items[0][price_data][product_data][name]",
      "Participation MyEvent"
    );

    params.append(
      "line_items[0][price_data][product_data][description]",
      "Participation à la cagnotte de l'événement"
    );

    params.append(
      "line_items[0][price_data][unit_amount]",
      String(amountCents)
    );

    params.append(
      "line_items[0][quantity]",
      "1"
    );

    params.append(
      "success_url",
      successUrl
    );

    params.append(
      "cancel_url",
      cancelUrl
    );

    params.append(
      "customer_creation",
      "if_required"
    );

    if (eventId) {
      params.append(
        "metadata[event_id]",
        String(eventId)
      );
    }

    if (fundEntryId) {
      params.append(
        "metadata[fund_entry_id]",
        String(fundEntryId)
      );
    }

    if (userId) {
      params.append(
        "metadata[user_id]",
        String(userId)
      );
    }

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          "Authorization":
            `Bearer ${stripeKey}`,
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );

    const stripeData =
      await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error(
        "Stripe Checkout error:",
        stripeData
      );

      return res.status(500).json({
        error:
          "Impossible de créer le paiement Stripe.",
        details:
          stripeData?.error?.message ||
          "Erreur Stripe inconnue."
      });
    }

    return res.status(200).json({
      success: true,
      sessionId: stripeData.id,
      url: stripeData.url
    });

  } catch (error) {
    console.error(
      "create-payment-session error:",
      error
    );

    return res.status(500).json({
      error:
        "Erreur lors de la création du paiement.",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
};
