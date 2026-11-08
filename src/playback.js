import {angleDelta,interpolatePosition,courseBetween,separation} from './motion.js';
const lerp=(a,b,t)=>a===null||a===undefined||b===null||b===undefined?null:a+(b-a)*t;
const upper=(values,time)=>{let lo=0,hi=values.length;while(lo<hi){const mid=(lo+hi)>>>1;if(values[mid]<=time)lo=mid+1;else hi=mid;}return lo-1;};
export class PlaybackClock {
 constructor(){this.position=0;this.rate=1;this.running=false;}
 current(now){return this.position+(this.running?(now-this.anchor)*this.rate:0);}
 play(now){this.anchor=now;this.running=true;}
 pause(now){this.position=this.current(now);this.running=false;}
 seek(position,now){this.position=position;this.anchor=now;}
 setRate(rate,now){if(!Number.isFinite(rate)||rate<0.01||rate>100)throw Error('再生倍率は0.01〜100で指定してください');this.position=this.current(now);this.anchor=now;this.rate=rate;}
}
export class RidePlayback {
 constructor(samples){
  this.samples=samples;this.times=[];this.knots=[];let elapsed=0;
  samples.forEach((s,i)=>{
   if(i && (s.segment??0)===(samples[i-1].segment??0))elapsed+=Math.max(0,Date.parse(s.time)-Date.parse(samples[i-1].time));
   this.times.push(elapsed);
   const prev=this.knots.at(-1);
   if(!prev || prev.sample.latitude!==s.latitude || prev.sample.longitude!==s.longitude || (prev.sample.segment??0)!==(s.segment??0))this.knots.push({time:elapsed,sample:s});
  });
  this.duration=elapsed;this.knotTimes=this.knots.map(k=>k.time);
 }
 timeAtIndex(index){const i=Math.min(Math.floor(index),this.times.length-1),j=Math.min(i+1,this.times.length-1);return (this.times[i]??0)+((this.times[j]??0)-(this.times[i]??0))*(index-i);}
 frame(time){
  if(!this.samples.length)return null;
  time=Math.max(0,Math.min(this.duration,time));
  const i=Math.max(0,upper(this.times,time)),j=Math.min(i+1,this.samples.length-1),a=this.samples[i],b=this.samples[j];
  const t=this.times[j]>this.times[i]?(time-this.times[i])/(this.times[j]-this.times[i]):0;
  let sample={...a,time:new Date(Date.parse(a.time)+(Date.parse(b.time)-Date.parse(a.time))*t).toISOString(),lean:lerp(a.lean,b.lean,t),speed:lerp(a.speed,b.speed,t),pitch:lerp(a.pitch??0,b.pitch??0,t),acceleration:a.acceleration&&b.acceleration?Object.fromEntries(['x','y','z'].map(k=>[k,lerp(a.acceleration[k],b.acceleration[k],t)])):null};
  const k=Math.max(0,upper(this.knotTimes,time)),ka=this.knots[k],kb=this.knots[Math.min(k+1,this.knots.length-1)];
  const compatible=(ka.sample.segment??0)===(kb.sample.segment??0) && kb.time-ka.time<=10000 && separation(ka.sample,kb.sample)<2000;
  const u=compatible&&kb.time>ka.time?Math.min(1,(time-ka.time)/(kb.time-ka.time)):0;
  const heading=Number.isFinite(ka.sample.course)&&ka.sample.course>=0?ka.sample.course:courseBetween(ka.sample,kb.sample);
  const endHeading=Number.isFinite(kb.sample.course)&&kb.sample.course>=0?kb.sample.course:heading;
  const position=interpolatePosition({...ka.sample,bearing:heading},{...kb.sample,bearing:endHeading},u);
  sample={...sample,latitude:position.latitude,longitude:position.longitude,course:heading+angleDelta(heading,endHeading)*u};
  return {sample,index:i+(j>i?t:0),elapsed:time};
 }
}
