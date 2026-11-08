import {courseBetween} from './motion.js';
export const G = 9.80665;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm = a => Math.hypot(...a);
export const unit = a => { const n=norm(a); if(n<1e-6) throw Error('センサーの値が不正です'); return a.map(v=>v/n); };
export function calibrate(gravity) {
  const up=unit(gravity.map(v=>-v)), candidate=[0,0,-1];
  const forward=candidate.map((v,i)=>v-dot(candidate,up)*up[i]);
  if(norm(forward)<0.5) throw Error('端末を縦向き・画面をライダー側に固定してください');
  return {up,forward:unit(forward),right:unit(cross(unit(forward),up))};
}
export function measure(gravity, acceleration, basis) {
  return {lean:Math.atan2(dot(gravity,basis.right),-dot(gravity,basis.up))*180/Math.PI,
    acceleration:acceleration ? {x:dot(acceleration,basis.right),y:dot(acceleration,basis.forward),z:dot(acceleration,basis.up)} : null};
}
export const magnitude = s => s.acceleration ? Math.hypot(s.acceleration.x,s.acceleration.y,s.acceleration.z) : null;
export function metricValue(s,metric) { return metric==='speed' ? (s.speed===null?null:s.speed*3.6) : metric==='lean' ? (s.lean===null?null:Math.abs(s.lean)) : magnitude(s); }
export const DEFAULT_RANGES = {speed:{min:0,max:120},acceleration:{min:0,max:10},lean:{min:0,max:60}};
export function validateRanges(ranges) {
  const result={};
  for(const key of Object.keys(DEFAULT_RANGES)) {
    const r=ranges?.[key];
    if(!r || !Number.isFinite(r.min) || !Number.isFinite(r.max) || r.min<0 || r.max<=r.min) throw Error('色分けの範囲は0以上で、上限を下限より大きく設定してください');
    result[key]={min:r.min,max:r.max};
  }
  return result;
}
export function color(s,metric,ranges=DEFAULT_RANGES) {
  const v=metricValue(s,metric); if(v===null) return '#768296';
  const {min,max}=ranges[metric];
  const ratio=clamp((v-min)/(max-min),0,1);
  return `hsl(${Math.round((1-ratio)*220)}, 90%, 57%)`;
}
export function destination(lat,lon,bearing,meters) {
  const r=bearing*Math.PI/180;
  return [lon+Math.sin(r)*meters/(111320*Math.cos(lat*Math.PI/180)),lat+Math.cos(r)*meters/111320];
}
export function distance(samples) {
  return samples.slice(1).reduce((sum,s,i)=>{
    const a=samples[i], rad=Math.PI/180;
    const h=Math.sin((s.latitude-a.latitude)*rad/2)**2+Math.cos(s.latitude*rad)*Math.cos(a.latitude*rad)*Math.sin((s.longitude-a.longitude)*rad/2)**2;
    return sum+6371000*2*Math.asin(Math.sqrt(clamp(h,0,1)));
  },0);
}
export function demoRide() {
  const startedAt=new Date().toISOString();
  const samples=Array.from({length:420},(_,i)=>{
    const t=i/419*Math.PI*2;
    return {id:crypto.randomUUID(),time:new Date(Date.parse(startedAt)+i*1000).toISOString(),latitude:35.211+0.011*Math.sin(t),longitude:138.994+0.016*Math.cos(t)+0.003*Math.sin(t*3),altitude:750+30*Math.sin(t),speed:13+6*Math.cos(t*3),course:(360-t*180/Math.PI)%360,accuracy:4,lean:34*Math.sin(t*3),acceleration:{x:3.5*Math.sin(t*3),y:2*Math.sin(t*5),z:0.3*Math.cos(t*7)}};
  });
  samples.forEach((s,i)=>{s.course=courseBetween(samples[Math.max(0,i-1)],samples[Math.min(samples.length-1,i+1)]);});
  return {schemaVersion:1,id:crypto.randomUUID(),name:'箱根スカイライン / DEMO',startedAt,samples,isDemo:true};
}
export function validateRide(input) {
  if(!input || input.schemaVersion!==1 || !Array.isArray(input.samples) || !input.samples.length || input.samples.length>500000) throw Error('対応する走行JSONではありません（最大50万点）');
  // Swift JSONEncoder's default Date is seconds from 2001-01-01.
  const date = v => { const d = typeof v==='number' ? new Date(978307200000+v*1000) : new Date(v); if(!Number.isFinite(d.getTime())) throw Error('日時が不正です'); return d.toISOString(); };
  const finite = v => typeof v==='number' && Number.isFinite(v);
  const samples=input.samples.map(s=>{
    if(!s || !finite(s.latitude) || Math.abs(s.latitude)>90 || !finite(s.longitude) || Math.abs(s.longitude)>180 || !(s.lean===null || finite(s.lean)) || !(s.speed===null || (finite(s.speed)&&s.speed>=0)) || !(s.acceleration===null || (s.acceleration && ['x','y','z'].every(k=>finite(s.acceleration[k])))) || !finite(s.accuracy) || s.accuracy<0 || !(s.course===null || (finite(s.course)&&s.course>=-1&&s.course<=360)) || !(s.altitude===null || finite(s.altitude))) throw Error('サンプルの値が不正です');
    return {...s,time:date(s.time)};
  });
  if(samples.some((s,i)=>i>0 && Date.parse(s.time)<Date.parse(samples[i-1].time))) throw Error('時刻の順序が不正です');
  return {...input,id:crypto.randomUUID(),name:String(input.name||'読み込んだ走行').slice(0,120),startedAt:date(input.startedAt),samples};
}
