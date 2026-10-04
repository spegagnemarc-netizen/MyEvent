(function(root){
  function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  // Date inputs expose YYYY-MM-DD even on a French iPhone. Check the calendar
  // directly so Safari's Date parser cannot turn a valid input into an error.
  function validDate(v){
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
    const year=Number(v.slice(0,4)),month=Number(v.slice(5,7)),day=Number(v.slice(8,10));
    if(year<1||month<1||month>12||day<1)return false;
    const leap=year%4===0&&(year%100!==0||year%400===0);
    const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    return day<=days[month-1];
  }
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
  // There is no approved hotel supplier yet. Enable this only with an
  // authorized provider on the server and a tested Preview deployment.
  const api={today,validate,integratedSearchEnabled:false};if(typeof module==='object')module.exports=api;else root.MyEventAccommodation=api;
})(typeof window==='object'?window:this);
