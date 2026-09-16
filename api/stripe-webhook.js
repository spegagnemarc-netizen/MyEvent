const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Supabase : on retire les éventuels "/" à la fin de l'URL
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      );
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).send("Signature Stripe manquante");
  }

  try {
    /*
     * Récupération du corps brut envoyé par Stripe.
     * Nécessaire pour vérifier correctement la signature.
     */
    const rawBody = await getRawBody(req);

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log("Stripe event reçu :", event.type);

    /*
     * Paiement Checkout terminé avec succès.
     */
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;

      console.log(
        "Stripe session :",
        session.id
      );

      console.log(
        "Payment status :",
        session.payment_status
      );

      /*
       * On ne confirme la participation
       * que lorsque Stripe indique que le paiement
       * est réellement payé.
       */
      if (session.payment_status === "paid") {

        const fundEntryId =
          session.metadata?.fund_entry_id;

        const eventId =
          session.metadata?.event_id;

        const userId =
          session.metadata?.user_id;

        const amountCents =
          session.metadata?.amount_cents;

        console.log("Paiement confirmé :", {
          sessionId: session.id,
          eventId,
          fundEntryId,
          userId,
          amountCents
        });

        /*
         * Sécurité :
         * le paiement doit être relié à une entrée
         * de cagnotte MyEvent.
         */
        if (!fundEntryId) {
          console.warn(
            "Paiement Stripe sans fund_entry_id"
          );

          return res.status(200).json({
            received: true,
            warning: "fund_entry_id manquant"
          });
        }

        /*
         * Paiement Stripe payé :
         * la participation est automatiquement confirmée.
         *
         * pending → confirmed
         */
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/event_fund_entries?id=eq.${encodeURIComponent(
            fundEntryId
          )}`,
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
            "Erreur Supabase :",
            text
          );

          return res.status(500).send(
            "Erreur lors de la confirmation Supabase"
          );
        }

        console.log(
          "Participation MyEvent automatiquement confirmée :",
          fundEntryId
        );

      } else {

        console.log(
          "Session reçue mais paiement non confirmé :",
          session.payment_status
        );
      }
    }

    /*
     * Stripe peut envoyer d'autres événements.
     * On les accepte sans modifier MyEvent.
     */
    return res.status(200).json({
      received: true
    });

  } catch (error) {

    console.error(
      "Stripe webhook error :",
      error
    );

    return res.status(400).send(
      `Webhook Error: ${error.message}`
    );
  }
};

/*
 * Désactive le body parser automatique
 * afin de récupérer le corps brut envoyé par Stripe.
 */
module.exports.config = {
  api: {
    bodyParser: false
  }
};
