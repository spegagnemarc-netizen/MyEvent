// Never execute an advertising SDK in ORÉVAMI's authenticated document.
// A config flag or CMP callback cannot waive the document isolation boundary.
const ISOLATION_REASON='Diffusion indisponible dans le document privé. Surface publique isolée et validation régie requises.';
export function createAdMobAdapter(){return Object.freeze({name:'AdMob',available:false,reason:'Application native et SDK AdMob/UMP à intégrer.'});}
export function createAdSenseAdapter(){
 return Object.freeze({name:'AdSense',reason:ISOLATION_REASON,available:()=>false,initialize:()=>false,mount:()=>false,destroy(){}});
}
