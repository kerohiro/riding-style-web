import {calibrate,measure,dot,norm} from './core.js';
export class Recorder {
  constructor(onSample,onStatus,onStop,onFix,onMotion) {
    Object.assign(this,{onSample,onStatus,onStop,onFix,onMotion,previewTime:-Infinity,basis:null,gravity:null,acceleration:null,fix:null,active:false,paused:false,segment:0,last:0,imuTime:0});
    window.addEventListener('devicemotion',e=>this.motion(e));
    document.addEventListener('visibilitychange',()=>{if(document.hidden && this.active && !this.paused)this.stop('画面が非表示になったため停止・保存しました');});
  }
  async enable() {
    if(!window.isSecureContext)throw Error('HTTPSで開いてください');
    if(!window.DeviceMotionEvent)throw Error('このブラウザはモーション取得に対応していません');
    // Call directly within the click gesture; do not request orientation unnecessarily.
    if(typeof DeviceMotionEvent.requestPermission==='function' && await DeviceMotionEvent.requestPermission()!=='granted')throw Error('モーションセンサーの許可が必要です。Safariの設定を確認してください');
    this.onStatus('センサー許可済み。停車・直立状態で基準を設定してください');
  }
  calibrate() {
    if(this.active && !this.paused)throw Error('記録を一時中断または停止してから基準を設定してください');
    if(!this.gravity || performance.now()-this.imuTime>2000)throw Error('センサー値を受信していません。「センサーを許可」を押して実機で確認してください');
    this.basis=calibrate(this.gravity);this.onStatus(this.paused?'直立基準を設定しました。記録を再開できます':'直立基準を設定しました。記録を開始できます');
  }
  motion(e) {
    const g=e.accelerationIncludingGravity, a=e.acceleration;
    if(!g || ![g.x,g.y,g.z].every(Number.isFinite))return;
    this.acceleration=a && [a.x,a.y,a.z].every(Number.isFinite)?[a.x,a.y,a.z]:null;
    // W3C proper acceleration includes +g at rest. Convert to downward gravity.
    this.gravity=[g.x,g.y,g.z].map((v,i)=>(this.acceleration?.[i]??0)-v);
    this.imuTime=performance.now();this.rotationRate=e.rotationRate?{alpha:e.rotationRate.alpha,beta:e.rotationRate.beta,gamma:e.rotationRate.gamma}:null;
    if(norm(this.gravity)>0.01 && this.imuTime-this.previewTime>=33) {
      const basis=this.basis??{right:[1,0,0],forward:[0,0,-1],up:[0,1,0]};
      this.previewTime=this.imuTime;
      this.onMotion?.({...measure(this.gravity,this.acceleration,basis),pitch:Math.atan2(dot(this.gravity,basis.forward),-dot(this.gravity,basis.up))*180/Math.PI,receivedAt:this.imuTime,calibrated:!!this.basis});
    }
    const now=Date.now();
    if(!this.active || this.paused || now-this.last<100 || !this.fix || now-this.fix.timestamp>3000)return;
    this.last=now;
    const c=this.fix.coords, values=measure(this.gravity,this.acceleration,this.basis);
    this.ride.samples.push({segment:this.segment,id:crypto.randomUUID(),time:new Date(now).toISOString(),latitude:c.latitude,longitude:c.longitude,altitude:c.altitude,speed:c.speed>=0?c.speed:null,course:c.heading,accuracy:c.accuracy,...values,motion:{gravity:this.gravity,rotationRate:this.rotationRate,deviceAcceleration:this.acceleration}});
    this.onSample(this.ride);
    if(this.ride.samples.length>=500000)this.stop('記録上限に達したため停止しました');
  }
  async start() {
    if(this.active)return;
    if(!this.basis)throw Error('先に直立基準を設定してください');
    if(performance.now()-this.imuTime>2000)throw Error('モーションデータが停止しています。センサー許可を確認してください');
    if(!navigator.geolocation)throw Error('GPSが利用できません');
    this.fix=null;this.last=0;this.active=true;this.paused=false;this.segment=0;
    const startedAt=new Date().toISOString();
    this.ride={schemaVersion:1,id:crypto.randomUUID(),name:new Date().toLocaleString('ja-JP')+' の走行',startedAt,samples:[],pauses:[],isDemo:false};
    await this.attachWatch();
  }
  async attachWatch() {
    const generation=this.watchGeneration=(this.watchGeneration??0)+1;
    this.fix=null;this.last=0;
    this.watch=navigator.geolocation.watchPosition(fix=>{
      if(!this.active || this.paused || generation!==this.watchGeneration)return;
      if(fix.coords.accuracy<=50){this.fix=fix;this.onFix?.(fix);this.onStatus(`記録中 • GPS ±${Math.round(fix.coords.accuracy)} m`);}
      else this.onStatus(`GPS精度待ち ±${Math.round(fix.coords.accuracy)} m`);
    },e=>{if(!this.active || this.paused || generation!==this.watchGeneration)return;this.onStatus('GPS: '+e.message);if(e.code===1)this.stop('位置情報が拒否されたため停止しました');}, {enableHighAccuracy:true,maximumAge:0,timeout:15000});
    this.onStatus('記録中 • GPS受信待ち。画面を表示したまま使用してください');
    let wake;
    try {wake=await navigator.wakeLock?.request('screen');} catch { /* recording remains available */ }
    if(!this.active || this.paused || generation!==this.watchGeneration){await wake?.release();return;}
    this.wake=wake;
    this.health=setInterval(()=>{
      if(performance.now()-this.imuTime>5000)this.stop('センサー受信が停止したため記録を終了しました');
      else if(!this.fix || Date.now()-this.fix.timestamp>5000)this.onStatus('GPS受信待ち • 有効な測位がない間は記録されません');
    },2000);
  }
  pause() {
    if(!this.active || this.paused)return;
    this.paused=true;this.watchGeneration++;clearInterval(this.health);navigator.geolocation.clearWatch(this.watch);
    this.fix=null;this.wake?.release();this.wake=null;
    this.ride.pauses.push({startedAt:new Date().toISOString()});
    this.onStatus('記録を一時中断中 • 再開すると同じ走行ログへ記録を続けます');
  }
  async resume() {
    if(!this.active || !this.paused)return;
    if(performance.now()-this.imuTime>2000)throw Error('センサー値を受信していません。画面を表示してセンサー設定を確認してください');
    this.ride.pauses.at(-1).endedAt=new Date().toISOString();
    this.segment++;this.paused=false;
    await this.attachWatch();
  }
  stop(reason='記録を終了しました') {
    if(!this.active)return;
    if(this.paused && this.ride.pauses.at(-1))this.ride.pauses.at(-1).endedAt=new Date().toISOString();
    this.active=false;this.paused=false;this.watchGeneration++;clearInterval(this.health);navigator.geolocation.clearWatch(this.watch);this.wake?.release();this.wake=null;
    this.onStatus(reason);this.onStop(this.ride);
  }
}
