import planning from '../server/outing-plan.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Méthode non autorisée.'
    });
  }

  const body = req.body || {};
  let context;
  try { context = planning.prepare(body); }
  catch (error) { return res.status(error.status || 400).json({error:error.message,code:error.code || 'INVALID_INPUT'}); }
  // Explicit pagination uses only the request's cached candidate set, never Geoapify/OpenAI.
  if(body.mode==='alternatives'){
    try{
      const primary=planning.fromModel({options:body.primary_options},context,true);
      const supplied=body.alternative_policy;
      const policy=planning.alternativePolicy(context,body,supplied?{preferences_checked:true,alternative_candidate_ids:supplied.candidate_ids,required_candidate_groups:supplied.required_groups}:null);
      const expanded=planning.expand(context,body,primary,policy,body.cursor,true);
      res.setHeader('Cache-Control','no-store');
      return res.status(200).json({...planning.response(context,body,expanded.options,null),...expanded,mode:'alternatives'});
    }catch(error){return res.status(error.status||400).json({error:error.message,code:error.code||'INVALID_PAGE'});}
  }
  const {people,budget,startTime,mealTime,requestedSteps} = context;
  const safeCandidates=[...context.candidates.filter(c=>c.type==='restaurant').slice(0,12),...context.candidates.filter(c=>c.type!=='restaurant').slice(0,24)];
  const request=String(body.request||'').trim(), eventName=String(body.event_name||'').trim();
  const eventDate=String(body.event_date||'').trim(),eventLocation=String(body.event_location||'').trim();
  const mealType=context.mealType;
  const mealInstruction=mealType==='lunch'?'déjeuner':mealType==='dinner'?'dîner':'repas';
  let failure=process.env.OPENAI_API_KEY?null:'AI_NOT_CONFIGURED';
  let options=[],policy=null;
  if (!failure) try {
    const prompt = `
Tu es l'organisateur IA de ORÉVAMI.

Construis une sortie complète multi-étapes à partir UNIQUEMENT
des lieux candidats fournis.

Événement :
${eventName || 'Événement'}

Date :
${eventDate || 'non précisée'}

Lieu :
${eventLocation || 'non précisé'}

Participants :
${people}

Budget maximum par personne :
${budget == null ? 'non précisé' : budget + ' €'}

Nombre d'étapes souhaité :
${context.targetSteps}

Heure de début souhaitée :
${startTime || 'non précisée'}

Repas :
${mealInstruction}

Demande de l'utilisateur :
${request || 'sortie conviviale et équilibrée'}

OBJECTIF :
- Proposer au maximum 3 combinaisons distinctes de ${context.targetSteps} lieux.
- Une seule étape restaurant et les autres étapes activités, culture ou nature.
- Utiliser uniquement les identifiants candidats fournis, sans répétition.
- Respecter les contraintes connues de budget, participants et rayon.
- Ne pas inventer d'ouverture, d'horaire, de durée, de prix ou de disponibilité.
- Les horaires explicites de l'utilisateur et les prix des candidats seront repris côté serveur.
- Renvoyer uniquement les identifiants ; ne pas recopier adresses et coordonnées.
- Pour les variantes automatiques, indique alternative_candidate_ids : uniquement les lieux compatibles avec la demande, sans inventer leurs caractéristiques.
- required_candidate_groups : pour CHAQUE exigence explicite (ex. bowling), une liste des IDs réellement compatibles. Une variante doit contenir au moins un ID de chaque groupe.
- Si tu ne peux pas vérifier les préférences avec les données fournies, mets preferences_checked à false. Ne présume pas une caractéristique absente des candidats.

JSON STRICT : {"options":[{"steps":[{"candidate_id":"identifiant exact"}]}],"preferences_checked":true,"alternative_candidate_ids":["identifiant exact"],"required_candidate_groups":[]}

CANDIDATS :

${JSON.stringify(safeCandidates)}
`;

    const response = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        signal: AbortSignal.timeout(12000),

        headers: {
          'Content-Type': 'application/json',
          'Authorization':
            `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model:
            process.env.OPENAI_MATERIAL_MODEL ||
            'gpt-5.6-luna',

          input: prompt,

          max_output_tokens: 3500
        })
      }
    );

    if (!response.ok) {
      failure=response.status===429?'AI_QUOTA':'AI_HTTP';
    } else {
      let data;
      try { data=await response.json(); } catch (error) { if(error?.name==='TimeoutError'||error?.name==='AbortError')throw error; failure='AI_RESPONSE'; }
      if(data){
        let text=data.output_text||'';
        if(!text&&Array.isArray(data.output))text=data.output.flatMap(o=>Array.isArray(o.content)?o.content:[]).map(c=>c.text||'').join('');
        try {
          const parsed=JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
          options=planning.fromModel(parsed,context);
          policy=planning.alternativePolicy(context,body,parsed);
          if(!options.length)failure='AI_RESPONSE';
        } catch (_) { failure='AI_RESPONSE'; }
      }
    }
  } catch(error) {
    failure=['TimeoutError','AbortError'].includes(error?.name)?'AI_TIMEOUT':'AI_NETWORK';
  }
  if(failure){
    console.warn('[ORÉVAMI outing plan]',failure);
    options=planning.fallback(context);
  }
  if(!options.length)return res.status(422).json({error:'Aucune combinaison de lieux disponibles ne respecte les critères connus de budget et d’étapes. Ajuste ces critères ou le rayon.',code:'NO_COMPATIBLE_COMBINATION'});
  res.setHeader('Cache-Control','no-store');
  if(!policy)policy=planning.alternativePolicy(context,body,null);
  const expanded=planning.expand(context,body,options,policy);
  const result=planning.response(context,body,expanded.options,failure);
  if(expanded.options.some(o=>o.generation==='deterministic')&&!failure)result.warning+=' Les variantes supplémentaires sont composées automatiquement à partir des mêmes lieux.';
  if(String(body.request||'').trim()&&!policy)result.warning+=' Les préférences libres ne permettent pas de vérifier d’autres combinaisons : seules les propositions initiales sont conservées.';
  return res.status(200).json({...result,...expanded});
}
