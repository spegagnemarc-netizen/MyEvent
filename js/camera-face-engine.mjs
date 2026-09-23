const vendor=new URL('../assets/vendor/mediapipe/',import.meta.url);
const cancelled=()=>new DOMException('Camera closed','AbortError');

export class FaceEngine {
  constructor(){
    this.closed=false;this.worker=null;this.task=null;this.pending=new Map();this.nextId=0;
    this.queue=Promise.resolve();this.loading=null;this.backend='loading';this.mode='IMAGE';this.timestamp=0;
    this.abort=new AbortController();
  }
  rpc(type,payload={},transfer=[]){
    if(this.closed||!this.worker)return Promise.reject(cancelled());
    return new Promise((resolve,reject)=>{
      const id=++this.nextId;
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Face worker timeout'));},type==='init'?30000:10000);
      this.pending.set(id,{resolve,reject,timer});
      try{this.worker.postMessage({id,type,...payload},transfer);}
      catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}
    });
  }
  stopWorker(){
    this.worker?.terminate();this.worker=null;
    for(const {reject,timer} of this.pending.values()){clearTimeout(timer);reject(cancelled());}
    this.pending.clear();
  }
  async startMain(){
    const {FaceLandmarker,FilesetResolver}=await import(new URL('0.10.21/vision_bundle.mjs',vendor).href);
    if(this.closed)throw cancelled();
    const response=await fetch(new URL('models/face_landmarker-float16-v1.task',vendor),{signal:this.abort.signal});
    if(!response.ok)throw new Error('Modèle local indisponible');
    const model=new Uint8Array(await response.arrayBuffer());
    const files=await FilesetResolver.forVisionTasks(new URL('0.10.21/wasm',vendor).href);
    if(this.closed)throw cancelled();
    const task=await FaceLandmarker.createFromOptions(files,{
      baseOptions:{modelAssetBuffer:model,delegate:'CPU'},runningMode:'IMAGE',numFaces:1,
      outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false
    });
    if(this.closed){task.close();throw cancelled();}
    this.task=task;this.mode='IMAGE';this.backend='main';
  }
  async initialize(){
    if(typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap==='function'){
      try{
        this.worker=new Worker(new URL('./camera-face-worker.js',import.meta.url));
        this.worker.onmessage=({data})=>{
          const request=this.pending.get(data.id);if(!request)return;
          clearTimeout(request.timer);this.pending.delete(data.id);
          if(data.error)request.reject(new Error(data.error));else request.resolve(data.landmarks||null);
        };
        this.worker.onerror=()=>this.stopWorker();
        await this.rpc('init');if(this.closed)throw cancelled();this.backend='worker';return;
      }catch(error){this.stopWorker();if(this.closed)throw cancelled();}
    }
    await this.startMain();
  }
  detect(source,mode='IMAGE'){
    // Serialize still photos and live frames; no simultaneous WASM calls or mode changes.
    const operation=this.queue.then(async()=>{
      if(this.closed)throw cancelled();
      if(!this.loading)this.loading=this.initialize();
      await this.loading;if(this.closed)throw cancelled();
      if(!this.worker&&!this.task)await this.startMain();
      if(this.worker){
        let bitmap;
        try{
          bitmap=await createImageBitmap(source);
          if(this.closed){bitmap.close();throw cancelled();}
          return await this.rpc('detect',{bitmap,mode,timestamp:performance.now()},[bitmap]);
        }catch(error){
          bitmap?.close();this.stopWorker();if(this.closed)throw cancelled();
          await this.startMain();
        }
      }
      if(this.closed)throw cancelled();
      if(this.mode!==mode){await this.task.setOptions({runningMode:mode});this.mode=mode;}
      if(this.closed)throw cancelled();
      this.timestamp=Math.max(this.timestamp+1,performance.now());
      const result=mode==='VIDEO'?this.task.detectForVideo(source,this.timestamp):this.task.detect(source);
      return result.faceLandmarks[0]||null;
    });
    this.queue=operation.catch(()=>{});return operation;
  }
  close(){
    this.closed=true;this.abort.abort();this.stopWorker();
    this.task?.close();this.task=null;this.loading=null;this.backend='closed';
  }
}
