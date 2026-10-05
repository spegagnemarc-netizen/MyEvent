import React,{useEffect,useRef,useState} from 'react';
import {Alert,Linking,Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {File} from 'expo-file-system';
import {WEB_ORIGIN,WEB_URL} from './config';
import {CameraScreen} from './camera/CameraScreen';
import type {CapturedMedia} from './camera/contract';
import {importPhotoScript,MAX_PHOTO_BYTES,trustedNavigation} from './bridge/protocol.mjs';

export default function App(){
  const web=useRef<WebView>(null),sequence=useRef(0);
  const pending=useRef<{id:string;timer:ReturnType<typeof setTimeout>;resolve:()=>void;reject:(reason:Error)=>void}|null>(null);
  const [camera,setCamera]=useState(false),[url,setUrl]=useState(WEB_URL),[loaded,setLoaded]=useState(false),[status,setStatus]=useState('');
  function cancelTransfer(message:string){
    const transfer=pending.current;pending.current=null;
    if(transfer){clearTimeout(transfer.timer);transfer.reject(new Error(message));}
  }
  useEffect(()=>()=>cancelTransfer('Écran fermé.'),[]);
  function openNativeCamera(){
    web.current?.injectJavaScript(`if(location.origin===${JSON.stringify(WEB_ORIGIN)}){const v=document.getElementById('myeventCameraVideo');v?.srcObject?.getTracks().forEach(t=>t.stop());if(v)v.srcObject=null;}true;`);
    setCamera(true);
  }
  function openWebCamera(){setCamera(false);web.current?.injectJavaScript(`if(location.origin===${JSON.stringify(WEB_ORIGIN)})document.getElementById('socialBottomCreate')?.click();true;`);}
  function closeNativeCamera(){
    cancelTransfer('Transfert annulé.');
    setCamera(false);
    web.current?.injectJavaScript(`if(location.origin===${JSON.stringify(WEB_ORIGIN)}){const m=document.getElementById('myeventCameraModal');if(m?.classList.contains('open')&&m.dataset.cameraState==='viewfinder')document.getElementById('socialBottomCreate')?.click();}true;`);
  }
  async function usePhoto(photo:CapturedMedia){
    if(!loaded || !trustedNavigation(url,WEB_ORIGIN))throw new Error('Chargez l’accueil MyEvent TEST avant l’import.');
    const file=new File(photo.uri);
    if(!file.exists || file.size>MAX_PHOTO_BYTES)throw new Error('Photo trop volumineuse (4 Mo maximum).');
    const data=await file.base64();
    const id=`photo-${++sequence.current}`;
    const script=importPhotoScript(data,WEB_ORIGIN,id);
    if(!web.current)throw new Error('Écran web indisponible.');
    if(pending.current)throw new Error('Transfert déjà en cours.');
    setStatus('Transfert vers l’aperçu MyEvent…');
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(()=>cancelTransfer('Import non confirmé : réessayez depuis l’accueil MyEvent.'),8000);
      pending.current={id,timer:timeout,resolve,reject};web.current?.injectJavaScript(script);
    });
    setCamera(false);
  }
  return <SafeAreaProvider><SafeAreaView style={styles.screen}>
    <View style={styles.bar}><Text style={styles.title}>MyEvent · TEST</Text><Pressable accessibilityRole="button" onPress={openNativeCamera} style={styles.button}><Text style={styles.title}>Caméra ME</Text></Pressable></View>
    {!!status&&<Text style={styles.status}>{status}</Text>}
    <WebView ref={web} source={{uri:WEB_URL}} style={{flex:1}} sharedCookiesEnabled thirdPartyCookiesEnabled={false} javaScriptEnabled allowsInlineMediaPlayback geolocationEnabled setSupportMultipleWindows
      onLoadStart={()=>{setLoaded(false);cancelTransfer('Navigation en cours, transfert annulé.');}}
      onLoadEnd={()=>setLoaded(true)}
      onNavigationStateChange={navigation=>setUrl(navigation.url)}
      onError={()=>{setLoaded(false);cancelTransfer('Connexion MyEvent TEST perdue.');setStatus('Connexion à MyEvent TEST impossible.');}}
      onShouldStartLoadWithRequest={request=>{
        if(trustedNavigation(request.url,WEB_ORIGIN))return true;
        // Partner iframes stay embedded; only top-level external navigation opens the system browser.
        if(request.isTopFrame===false)return request.url.startsWith('https://');
        if(/^https?:\/\//.test(request.url))void Linking.openURL(request.url).catch(()=>Alert.alert('Lien partenaire','Ouverture impossible.'));
        return false;
      }}
      onOpenWindow={event=>{const target=event.nativeEvent.targetUrl;if(/^https?:\/\//.test(target))void Linking.openURL(target);}}
      onMessage={event=>{
        if(!pending.current || !trustedNavigation(event.nativeEvent.url,WEB_ORIGIN))return;
        try{const message=JSON.parse(event.nativeEvent.data);
          if(message.version!==1 || message.id!==pending.current.id)return;
          if(!['imported','import-unavailable'].includes(message.type))return;
          const transfer=pending.current;pending.current=null;clearTimeout(transfer.timer);
          if(message.type==='imported'){transfer.resolve();setStatus('Photo transférée : vérifiez l’aperçu, puis validez la publication.');}
          else{transfer.reject(new Error('Import indisponible : chargez l’accueil MyEvent.'));setStatus('Import web indisponible.');}
        }catch{/* Only photo-import acknowledgements; no commands, tokens or uploads from web. */}
      }}/>
    <Modal visible={camera} animationType="slide" onRequestClose={closeNativeCamera}>
      <SafeAreaView style={styles.screen}>{camera&&<CameraScreen onClose={closeNativeCamera} onUse={usePhoto} onWebEffects={openWebCamera}/>}</SafeAreaView>
    </Modal>
  </SafeAreaView></SafeAreaProvider>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#07131c'},bar:{padding:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{color:'white',fontWeight:'700'},button:{padding:10,borderRadius:10,backgroundColor:'#224055'},status:{padding:8,color:'#ffda82'}});
