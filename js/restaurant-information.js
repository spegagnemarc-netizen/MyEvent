(function(root){
  'use strict';
  async function load(website,{signal}={}){
    if(!website)return {status:'unavailable',opening_hours:[],prices:[],menus:[],booking_links:[],sources:[],checked_at:null,notice:'Information non disponible : site officiel non renseigné.'};
    const response=await fetch('/api/integration-venues?mode=restaurant-information',{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url:website}),signal
    });
    if(!response.ok)throw Error('Information non disponible');
    return response.json();
  }
  let sheet;
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-restaurant-details]');
    if(!button||!root.OrevamiVenueSheet)return;
    try{
      const venue=JSON.parse(button.dataset.restaurantDetails);
      if(!sheet)sheet=root.OrevamiVenueSheet.create({host:document.body,readOnly:true});
      sheet.open(venue);
    }catch{button.textContent='Information non disponible';}
  });
  root.OrevamiRestaurantInformation=Object.freeze({load});
})(window);
