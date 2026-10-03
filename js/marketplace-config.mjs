// No embedded project or credential; await the shared environment boundary.
export async function marketplaceConfig(){
 if(!window.myeventRuntime)throw Error('Configuration de connexion indisponible.');
 return window.myeventRuntime.ready;
}
