(function(root){
  function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;}
  function validate(q, minimum=today()){
    if(typeof q.destination!=='string'||!q.destination.trim()||q.destination.trim().length>200)return 'Indique une destination de 1 à 200 caractères.';
    if(!validDate(q.checkIn)||!validDate(q.checkOut))return 'Indique des dates valides.';
    if(q.checkIn<minimum)return 'L’arrivée ne peut pas être dans le passé.';
    if(q.checkOut<=q.checkIn)return 'Le départ doit être après l’arrivée.';
    if(!Number.isInteger(q.guests)||q.guests<1||q.guests>30)return 'Indique de 1 à 30 voyageurs.';
    if(!Number.isInteger(q.rooms)||q.rooms<1||q.rooms>q.guests)return 'Indique au moins une chambre, sans dépasser le nombre de voyageurs.';
    if(!['all','hotel','apartment','camping'].includes(q.type))return 'Choisis un type d’hébergement valide.';
    return '';
  }
  const api={today,validate};if(typeof module==='object')module.exports=api;else root.MyEventAccommodation=api;
})(typeof window==='object'?window:this);
