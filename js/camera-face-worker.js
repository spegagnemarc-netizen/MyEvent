/* Classic worker: MediaPipe's pinned WASM loader uses importScripts. */
let task=null,mode='IMAGE',timestamp=0;
self.onmessage=async({data})=>{
  const {id,type,bitmap}=data;
  try{
    if(type==='init'){
      const {FaceLandmarker,FilesetResolver}=await import('../assets/vendor/mediapipe/0.10.21/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks(new URL('../assets/vendor/mediapipe/0.10.21/wasm',self.location.href).href);
      task=await FaceLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:new URL('../assets/vendor/mediapipe/models/face_landmarker-float16-v1.task',self.location.href).href,delegate:'CPU'},
        canvas:new OffscreenCanvas(2,2),runningMode:'IMAGE',numFaces:1,
        outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false
      });
      // A real inference probe, not a UA sniff or just a feature check.
      const probe=new OffscreenCanvas(16,16);probe.getContext('2d').fillRect(0,0,16,16);
      task.detect(probe);probe.width=probe.height=0;
      self.postMessage({id,ok:true});return;
    }
    if(!task)throw new Error('Face engine unavailable');
    if(mode!==data.mode){await task.setOptions({runningMode:data.mode});mode=data.mode;}
    timestamp=Math.max(timestamp+1,data.timestamp||performance.now());
    const result=mode==='VIDEO'?task.detectForVideo(bitmap,timestamp):task.detect(bitmap);
    self.postMessage({id,landmarks:result.faceLandmarks[0]||null});
  }catch(error){self.postMessage({id,error:String(error.message||error)});}
  finally{bitmap?.close();}
};
