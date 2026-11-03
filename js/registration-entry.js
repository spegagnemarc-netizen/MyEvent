/* Main page only redirects; private civil details are entered on the isolated page. */
(()=>{
const destination=edit=>{const u=new URL('register.html',location.href);u.search=location.search;if(edit)u.searchParams.set('edit','1');return u.href;};
async function open(edit=false){location.assign(destination(edit));}
async function gate(){return false;}
window.orevamiRegistration=Object.freeze({open,gate});
const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='Compléter / modifier ma fiche privée';b.onclick=()=>open(true);document.getElementById('saveProfileBtn').after(b);
})();
