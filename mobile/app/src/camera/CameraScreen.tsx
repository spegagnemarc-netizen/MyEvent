import React, {useEffect, useRef, useState} from 'react';
import {Alert, AppState, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CameraView, useCameraPermissions} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {DeviceMotion} from 'expo-sensors';
import {cropForRatio, pinchZoom} from './geometry.mjs';
import type {CameraRatio, CapturedMedia} from './contract';

interface Props {onClose(): void; onUse(media: CapturedMedia,action:'publish'|'event'): Promise<void>; onWebFallback(): void}
export function CameraScreen({onClose,onUse,onWebFallback}: Props) {
  const window=useWindowDimensions(),insets=useSafeAreaInsets();
  const camera=useRef<CameraView>(null);
  const [permission,requestPermission]=useCameraPermissions();
  const [facing,setFacing]=useState<'front'|'back'>('front');
  const [photo,setPhoto]=useState<CapturedMedia|null>(null);
  const [zoom,setZoom]=useState(0), [ratio,setRatio]=useState<CameraRatio>('4:3');
  const [grid,setGrid]=useState(false), [level,setLevel]=useState(false), [roll,setRoll]=useState(0);
  const [timer,setTimer]=useState(0), [countdown,setCountdown]=useState(0);
  const [busy,setBusy]=useState(false), [ready,setReady]=useState(false), [error,setError]=useState('');
  const [active,setActive]=useState(AppState.currentState==='active');
  const revision=useRef(0), gesture=useRef({distance:0,zoom:0}), zoomRef=useRef(0), busyRef=useRef(false);
  const mounted=useRef(true), galleryPending=useRef(false);
  zoomRef.current=zoom;
  useEffect(()=>{
    mounted.current=true;
    const sub=AppState.addEventListener('change',state=>{revision.current++;setActive(state==='active');setReady(false);setCountdown(0);});
    return ()=>{mounted.current=false;revision.current++;sub.remove();};
  },[]);
  useEffect(()=>{
    if(!level || !active || photo)return;
    let cancelled=false;let subscription:ReturnType<typeof DeviceMotion.addListener>|undefined;
    void (async()=>{
      try{
        if(!(await DeviceMotion.isAvailableAsync()))throw new Error('Niveau indisponible sur cet appareil.');
        const access=await DeviceMotion.requestPermissionsAsync();
        if(!access.granted)throw new Error('Permission de mouvement refusée.');
        if(cancelled)return;
        DeviceMotion.setUpdateInterval(100);
        subscription=DeviceMotion.addListener(data=>{if(data.rotation)setRoll(data.rotation.gamma);});
      }catch(e){if(!cancelled){setLevel(false);setError(e instanceof Error?e.message:'Niveau indisponible.');}}
    })();
    return ()=>{cancelled=true;subscription?.remove();};
  },[level,active,photo]);
  const pan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:e=>e.nativeEvent.touches.length===2,
    onMoveShouldSetPanResponder:e=>e.nativeEvent.touches.length===2,
    onPanResponderGrant:e=>{
      const [a,b]=e.nativeEvent.touches;if(!a || !b)return;
      gesture.current={distance:Math.hypot(a.pageX-b.pageX,a.pageY-b.pageY),zoom:zoomRef.current};
    },
    onPanResponderMove:e=>{
      const [a,b]=e.nativeEvent.touches;if(!a || !b)return;
      setZoom(pinchZoom(gesture.current.zoom,Math.hypot(a.pageX-b.pageX,a.pageY-b.pageY),gesture.current.distance));
    }
  })).current;
  async function capture(){
    if(!ready || !active || busyRef.current || galleryPending.current)return;
    busyRef.current=true;setBusy(true);setError('');const ticket=++revision.current;
    try{
      for(let n=timer;n>0;n--){setCountdown(n);await new Promise(r=>setTimeout(r,1000));if(ticket!==revision.current)return;}
      setCountdown(0);
      const result=await camera.current?.takePictureAsync({quality:0.85,skipProcessing:false});
      if(!result || ticket!==revision.current)return;
      const crop=cropForRatio(result.width,result.height,ratio);
      const image=await ImageManipulator.manipulateAsync(result.uri,[{crop}],{compress:0.85,format:ImageManipulator.SaveFormat.JPEG});
      if(ticket===revision.current)setPhoto({...image,mime:'image/jpeg',source:'camera',effectsBaked:false});
    }catch(e){if(ticket===revision.current)setError(e instanceof Error?e.message:'Capture impossible.');}
    finally{busyRef.current=false;setBusy(false);setCountdown(0);}
  }
  async function gallery(){
    if(busyRef.current || galleryPending.current)return;
    galleryPending.current=true;revision.current++;
    try{
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:0.9});
      if(result.canceled || !result.assets[0] || !mounted.current)return;
      const image=await ImageManipulator.manipulateAsync(result.assets[0].uri,[],{compress:0.85,format:ImageManipulator.SaveFormat.JPEG});
      if(mounted.current)setPhoto({...image,mime:'image/jpeg',source:'gallery',effectsBaked:false});
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Import impossible.');}
    finally{galleryPending.current=false;}
  }
  const control=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} disabled={disabled} style={[styles.button,disabled&&{opacity:0.4}]}><Text style={styles.text}>{label}</Text></Pressable>;
  function confirm(action:'publish'|'event'){
    if(!photo || busyRef.current)return;
    Alert.alert(action==='publish'?'Publier cette photo ?':'Ajouter à un événement ?',action==='publish'?'La photo sera publiée dans MyEvent.':'Vous choisirez ensuite l’événement dans MyEvent.',[
      {text:'Annuler',style:'cancel'},
      {text:action==='publish'?'Publier':'Choisir un événement',onPress:()=>{
        if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
        void onUse(photo,action).catch(e=>setError(e.message)).finally(()=>{busyRef.current=false;if(mounted.current)setBusy(false);});
      }}
    ]);
  }
  const aspect=ratio==='1:1'?1:ratio==='9:16'?9/16:3/4;
  const previewWidth=Math.min(window.width-24,Math.max(160,window.height-insets.top-insets.bottom-220)*aspect);
  return <View style={styles.screen}>
    <View style={styles.row}>{control('Fermer',onClose,busy)}<Text style={styles.text}>Caméra MyEvent</Text>{control('↻',()=>{setReady(false);setFacing(facing==='front'?'back':'front');setZoom(0);},busy||!!photo)}</View>
    <View style={{width:previewWidth,alignSelf:'center',aspectRatio:aspect,backgroundColor:'black',overflow:'hidden'}} {...pan.panHandlers}>
      {photo?<Image source={{uri:photo.uri}} style={StyleSheet.absoluteFill} resizeMode="contain"/>:
        permission?.granted && active?<CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} zoom={zoom} mode="picture" onCameraReady={()=>setReady(true)} onMountError={e=>setError(e.message)}/>:
        <View style={styles.center}><Text style={styles.text}>Autorisez la caméra ou choisissez une photo.</Text>{control('Autoriser caméra',()=>{void requestPermission();})}</View>}
      {grid&&!photo&&[1/3,2/3].map(p=><React.Fragment key={p}><View pointerEvents="none" style={{position:'absolute',left:`${p*100}%`,top:0,bottom:0,width:1,backgroundColor:'#ffffff70'}}/><View pointerEvents="none" style={{position:'absolute',top:`${p*100}%`,left:0,right:0,height:1,backgroundColor:'#ffffff70'}}/></React.Fragment>)}
      {level&&!photo&&<View pointerEvents="none" style={{position:'absolute',top:'50%',left:'35%',width:'30%',height:2,backgroundColor:Math.abs(roll)<0.04?'lime':'white',transform:[{rotate:`${roll}rad`}]}}/>}
      {!!countdown&&<Text style={styles.count}>{countdown}</Text>}
    </View>
    {!!error&&<Text accessibilityRole="alert" style={styles.text}>{error}</Text>}
    <ScrollView contentContainerStyle={{gap:8}}>
      {photo?<View style={styles.row}>{control('Reprendre',()=>{setPhoto(null);setReady(false);},busy)}{control('Publier',()=>confirm('publish'),busy)}{control('Ajouter à un événement',()=>confirm('event'),busy)}</View>:<>
        <View style={styles.row}>{control('Galerie',()=>{void gallery();},busy)}<Pressable accessibilityRole="button" accessibilityLabel="Prendre une photo MyEvent" onPress={()=>{void capture();}} disabled={busy||!ready} style={styles.shutter}><Image source={require('../assets/camera-me-logo.jpeg')} style={{width:64,height:64,borderRadius:32}}/></Pressable>{control('Zoom +',()=>setZoom(Math.min(1,zoom+0.1)),busy)}</View>
        <View style={styles.row}>{control(`Timer ${timer}s`,()=>setTimer(timer===0?3:timer===3?10:0),busy)}{control(`Grille ${grid?'✓':''}`,()=>setGrid(!grid))}{control(`Niveau ${level?'✓':''}`,()=>setLevel(!level))}</View>
        <View style={styles.row}>{(['4:3','1:1','9:16'] as CameraRatio[]).map(value=><React.Fragment key={value}>{control(value+ (value===ratio?' ✓':''),()=>setRatio(value),busy)}</React.Fragment>)}</View>
        {control('Caméra web de secours',onWebFallback,busy)}
      </>}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#07131c',padding:12,gap:8},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6,flexWrap:'wrap'},text:{color:'white',fontSize:14},note:{color:'#bac6d0',fontSize:12},button:{backgroundColor:'#223342',borderRadius:10,padding:10},center:{flex:1,alignItems:'center',justifyContent:'center',gap:10},shutter:{borderRadius:40,padding:6,borderWidth:2,borderColor:'#ffb438'},count:{position:'absolute',alignSelf:'center',top:'40%',fontSize:64,color:'white'}});
