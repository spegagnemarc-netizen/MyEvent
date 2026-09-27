/* Common multiplayer transport. Rules and private data live in Supabase RPCs. */
(() => {
  class GameSession extends EventTarget {
    constructor(context) { super(); this.context=context; this.roomId=null; this.state=null; this.epoch=0; this.refreshing=false; }
    async rpc(name,args={}) {
      const {sb,user}=this.context();
      if(!sb||!user) throw Error('Connecte-toi à MyEvent pour jouer.');
      const {data,error}=await sb.rpc(name,args);
      if(error) throw error;
      return data;
    }
    emit(name,detail) { this.dispatchEvent(new CustomEvent(name,{detail})); }
    async connect(id) {
      this.disconnect(); this.roomId=id; const epoch=this.epoch;
      try { await this.refresh(true); } catch(error) { if(epoch===this.epoch)this.disconnect();throw error; }
      if(epoch!==this.epoch)return;
      const {sb}=this.context();
      this.channel=sb.channel('game-room-'+id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_rooms',filter:'id=eq.'+id},()=>this.refresh()).subscribe(status=>{
        if(epoch===this.epoch)this.emit('connection',status==='SUBSCRIBED'?'live':'polling');
      });
      this.poll=setInterval(()=>{if(!document.hidden)this.refresh();},4000);
      this.pulse=setInterval(()=>{if(!document.hidden)this.rpc('game_action',{target_room:id,action:'heartbeat'}).catch(()=>{});},20000);
    }
    async refresh(strict=false) {
      if(!this.roomId)return;
      if(this.refreshing){this.refreshAgain=true;return;}
      this.refreshing=true; const epoch=this.epoch;
      try {
        const state=await this.rpc('game_snapshot',{target_room:this.roomId});
        if(epoch!==this.epoch)return;
        this.state=state; this.emit('state',state);
      } catch(error) { if(epoch===this.epoch)this.emit('error',error);if(strict)throw error; }
      finally { if(epoch===this.epoch){this.refreshing=false;if(this.refreshAgain){this.refreshAgain=false;this.refresh();}} }
    }
    async act(action,data={}) {
      await this.rpc('game_action',{target_room:this.roomId,action,data:{revision:this.state?.room.revision,...data}});
      await this.refresh();
    }
    async create(options,target_event=null) { const id=await this.rpc('game_create',{options,target_event});await this.connect(id); }
    async join(code) { const id=await this.rpc('game_join',{invitation_code:code});await this.connect(id);window.myeventInvitations?.clear('game'); }
    async leave() { await this.rpc('game_action',{target_room:this.roomId,action:'leave'});this.disconnect(); }
    disconnect() {
      this.epoch++; clearInterval(this.poll);clearInterval(this.pulse);
      if(this.channel)this.context().sb?.removeChannel(this.channel);
      this.channel=null;this.state=null;this.roomId=null;this.refreshing=false;this.refreshAgain=false;
    }
  }
  window.MyEventGameSession=GameSession;
})();
