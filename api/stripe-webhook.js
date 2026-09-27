const Stripe = require("stripe");

// Vercel peut contenir l'URL du projet OU l'URL de la Data API.
// Ne jamais concaténer /rest/v1 à un chemin qui le contient déjà.
function fundEntriesUrl(value, fundEntryId) {
  const url = new URL(String(value || "").trim());
  const path = url.pathname.replace(/\/+$/, "");
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || !["", "/rest/v1"].includes(path)) {
    throw new Error("Configuration SUPABASE_URL invalide");
  }
  url.pathname = "/rest/v1/event_fund_entries";
  url.searchParams.set("id", `eq.${fundEntryId}`);
  url.searchParams.set("select", "id,status");
  return url;
}

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

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Configuration Stripe webhook incomplète");
    return res.status(500).send("Configuration du webhook incomplète");
  }

  let event;
  try {
    /*
     * Récupération du corps brut envoyé par Stripe.
     * Nécessaire pour vérifier correctement la signature.
     */
    const rawBody = await getRawBody(req);

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

  } catch {
    // Ne pas renvoyer de détails de signature, de corps ou de secrets au client.
    console.warn("Signature Stripe invalide ou corps illisible");
    return res.status(400).send("Signature Stripe invalide");
  }

  try {
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
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseKey) throw new Error("Configuration Supabase incomplète");
        const url = fundEntriesUrl(process.env.SUPABASE_URL, fundEntryId);
        const response = await fetch(
          url,
          {
            method: "PATCH",

            headers: {
              "Content-Type": "application/json",

              apikey: supabaseKey,

              Authorization:
                `Bearer ${supabaseKey}`,

              Prefer: "return=representation"
            },

            body: JSON.stringify({
              status: "confirmed"
            })
          }
        );

        if (!response.ok) {
          const failure = await response.json().catch(() => ({}));

          console.error(
            "Erreur Supabase :",
            { status: response.status, code: failure.code, path: url.pathname }
          );

          return res.status(500).send(
            "Erreur lors de la confirmation Supabase"
          );
        }

        // Un PATCH sans ligne correspondante peut répondre 200. Ne pas
        // acquitter le paiement tant que la participation n'est pas confirmée.
        const entries = await response.json();
        if (!Array.isArray(entries) || entries.length !== 1 ||
            entries[0].id !== fundEntryId || entries[0].status !== "confirmed") {
          console.error("Participation Stripe introuvable ou non confirmée", { fundEntryId });
          return res.status(500).send("Participation MyEvent non confirmée");
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

  } catch {

    console.error(
      "Échec de confirmation Stripe : vérifier la configuration Supabase et sa disponibilité"
    );

    return res.status(500).send(
      "Erreur lors de la confirmation du paiement"
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
