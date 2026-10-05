import React,{useEffect,useRef,useState} from 'react';
import {Alert,Linking,Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {File} from 'expo-file-system';
import {uuid} from 'expo-modules-core';
import {WEB_ORIGIN,WEB_URL} from './config';
import {CameraScreen} from './camera/CameraScreen';
import type {CapturedMedia} from './camera/contract';
import {MAX_PHOTO_BYTES,trustedNavigation} from './bridge/protocol.mjs';
import {photoActionScript} from './bridge/photo-action.mjs';
import {cameraTriggerScript,cameraTriggerMessage,openWebCameraScript,releaseCameraTriggerScript} from './bridge/camera-trigger.mjs';

export default function App(){
  const web=useRef<WebView>(null),sequence=useRef(0);
  const [initialToken]=useState(()=>uuid.v4());
  const triggerToken=useRef(initialToken),nativeOpen=useRef(false);
  const [triggerReady,setTriggerReady]=useState(false);
  const actionIds=useRef(new Map<string,string>());
  const pending=useRef<{id:string;action:'publish'|'event';timer:ReturnType<typeof setTimeout>;resolve:()=>void;reject:(reason:Error)=>void}|null>(null);
  const [camera,setCamera]=useState(false),[url,setUrl]=useState(WEB_URL),[loaded,setLoaded]=useState(false),[status,setStatus]=useState('');
  function cancelTransfer(message:string){
    const transfer=pending.current;pending.current=null;
    if(transfer){clearTimeout(transfer.timer);transfer.reject(new Error(message));}
  }
  useEffect(()=>()=>cancelTransfer('Écran fermé.'),[]);
  function openNativeCamera(){
    if(nativeOpen.current)return;
    nativeOpen.current=true;
    web.current?.injectJavaScript(`if(location.origin===${JSON.stringify(WEB_ORIGIN)}){const v=document.getElementById('myeventCameraVideo');v?.srcObject?.getTracks().forEach(t=>t.stop());if(v)v.srcObject=null;}true;`);
    setCamera(true);
  }
  function openWebCamera(){nativeOpen.current=false;setCamera(false);web.current?.injectJavaScript(openWebCameraScript(WEB_ORIGIN));}
  function closeNativeCamera(){
    if(pending.current)return;
    cancelTransfer('Transfert annulé.');
    nativeOpen.current=false;
    setCamera(false);
    web.current?.injectJavaScript(releaseCameraTriggerScript(WEB_ORIGIN));
  }
  async function usePhoto(photo:CapturedMedia,action:'publish'|'event'){
    if(!loaded || !trustedNavigation(url,WEB_ORIGIN))throw new Error('Chargez l’accueil MyEvent TEST avant l’import.');
    const navigationToken=triggerToken.current;
    const file=new File(photo.uri);
    if(!file.exists || file.size>MAX_PHOTO_BYTES)throw new Error('Photo trop volumineuse (4 Mo maximum).');
    const data=await file.base64();
    if(!nativeOpen.current||navigationToken!==triggerToken.current)throw new Error('Action annulée : écran fermé ou navigation en cours.');
    const key=photo.uri+'|'+action;
    const id=actionIds.current.get(key)||('photo-'+triggerToken.current+'-'+(++sequence.current));
    actionIds.current.set(key,id);
    const script=photoActionScript(data,WEB_ORIGIN,id,action);
    if(!web.current)throw new Error('Écran web indisponible.');
    if(pending.current)throw new Error('Transfert déjà en cours.');
    setStatus(action==='publish'?'Publication en cours…':'Préparation du choix d’événement…');
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(()=>cancelTransfer('Résultat non confirmé : vérifiez MyEvent avant de réessayer.'),60000);
      pending.current={id,action,timer:timeout,resolve,reject};web.current?.injectJavaScript(script);
    });
    nativeOpen.current=false;
    setCamera(false);
  }
  return <SafeAreaProvider><SafeAreaView style={styles.screen}>
    <View style={styles.bar}><Text style={styles.title}>MyEvent · TEST</Text>{!triggerReady&&<Pressable accessibilityRole="button" onPress={openNativeCamera} style={styles.button}><Text style={styles.title}>Caméra ME</Text></Pressable>}</View>
    {!!status&&<Text style={styles.status}>{status}</Text>}
    <WebView ref={web} source={{uri:WEB_URL}} style={{flex:1}} sharedCookiesEnabled thirdPartyCookiesEnabled={false} javaScriptEnabled allowsInlineMediaPlayback geolocationEnabled setSupportMultipleWindows
      onLoadStart={()=>{setLoaded(false);setTriggerReady(false);triggerToken.current=uuid.v4();nativeOpen.current=false;setCamera(false);cancelTransfer('Navigation en cours, transfert annulé.');}}
      onLoadEnd={()=>{setLoaded(true);web.current?.injectJavaScript(cameraTriggerScript(WEB_ORIGIN,triggerToken.current));}}
      onNavigationStateChange={navigation=>setUrl(navigation.url)}
      onError={()=>{setLoaded(false);setTriggerReady(false);cancelTransfer('Connexion MyEvent TEST perdue.');setStatus('Connexion à MyEvent TEST impossible.');}}
      onShouldStartLoadWithRequest={request=>{
        if(trustedNavigation(request.url,WEB_ORIGIN))return true;
        // Partner iframes stay embedded; only top-level external navigation opens the system browser.
        if(request.isTopFrame===false)return request.url.startsWith('https://');
        if(/^https?:\/\//.test(request.url))void Linking.openURL(request.url).catch(()=>Alert.alert('Lien partenaire','Ouverture impossible.'));
        return false;
      }}
      onOpenWindow={event=>{const target=event.nativeEvent.targetUrl;if(/^https?:\/\//.test(target))void Linking.openURL(target);}}
      onMessage={event=>{
        const command=cameraTriggerMessage(event.nativeEvent.data,event.nativeEvent.url,WEB_ORIGIN,triggerToken.current);
        if(command?.type==='camera-trigger-ready'){setTriggerReady(command.available);return;}
        if(command?.type==='open-native-camera'){if(loaded&&!pending.current)openNativeCamera();return;}
        if(!pending.current || !trustedNavigation(event.nativeEvent.url,WEB_ORIGIN))return;
        try{const message=JSON.parse(event.nativeEvent.data);
          if(message.version!==1 || message.id!==pending.current.id)return;
          if(!['action-completed','action-failed','import-unavailable'].includes(message.type))return;
          const transfer=pending.current;pending.current=null;clearTimeout(transfer.timer);
          if(message.type==='action-completed'){transfer.resolve();setStatus(transfer.action==='publish'?'Photo publiée dans MyEvent.':'Choisissez un événement : la photo sera enregistrée après votre sélection.');}
          else{transfer.reject(new Error(message.error||'Action indisponible : chargez l’accueil MyEvent.'));setStatus('Action non enregistrée.');}
        }catch{/* Only camera requests and photo acknowledgements; no auth tokens or uploads from web. */}
      }}/>
    <Modal visible={camera} animationType="slide" onRequestClose={closeNativeCamera}>
      <SafeAreaView style={styles.screen}>{camera&&<CameraScreen onClose={closeNativeCamera} onUse={usePhoto} onWebFallback={openWebCamera}/>}</SafeAreaView>
    </Modal>
  </SafeAreaView></SafeAreaProvider>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#07131c'},bar:{padding:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{color:'white',fontWeight:'700'},button:{padding:10,borderRadius:10,backgroundColor:'#224055'},status:{padding:8,color:'#ffda82'}});
