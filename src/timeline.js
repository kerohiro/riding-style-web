import {magnitude} from './core.js';
export const TIMELINE_SERIES={
 lean:{label:'推定リーン角',unit:'°',color:'#54efbd',dash:[],value:s=>s.lean},
 speed:{label:'速度',unit:'km/h',color:'#65baff',dash:[7,4],value:s=>s.speed==null?null:s.speed*3.6},
 acceleration:{label:'合成加速度',unit:'m/s²',color:'#ffb567',dash:[2,4],value:magnitude}
};
const niceMax=value=>{const power=10**Math.floor(Math.log10(value||1));return [1,2,5,10].find(n=>n*power>=value)*power;};
export function timelineSeries(samples,key,pixels=1000){
 const meta=TIMELINE_SERIES[key],points=[];let min=Infinity,max=-Infinity,bucket=null,previousSegment;
 const stride=Math.max(1,Math.ceil(samples.length/Math.max(1,pixels)));
 const flush=()=>{if(!bucket)return;const unique=new Map([bucket.first,bucket.low,bucket.high,bucket.last].map(p=>[p.index,p]));points.push(...[...unique.values()].sort((a,b)=>a.index-b.index));bucket=null;};
 samples.forEach((s,index)=>{
  const value=meta.value(s),segment=s.segment??0;
  if(index && segment!==previousSegment){flush();points.push(null);}previousSegment=segment;
  if(!Number.isFinite(value)){flush();if(points.at(-1)!==null)points.push(null);return;}
  min=Math.min(min,value);max=Math.max(max,value);
  const group=Math.floor(index/stride),point={index,value};
  if(bucket?.group!==group)flush();
  if(!bucket)bucket={group,first:point,last:point,low:point,high:point};
  else {bucket.last=point;if(value<bucket.low.value)bucket.low=point;if(value>bucket.high.value)bucket.high=point;}
 });flush();
 const hasData=min!==Infinity;
 const upper=key==='lean'?Math.ceil(Math.max(60,Math.abs(min===Infinity?0:min),Math.abs(max===-Infinity?0:max))/15)*15:niceMax(Math.max(key==='speed'?20:1,hasData?max:0));
 return {...meta,key,min:key==='lean'?-upper:0,max:upper,points,hasData};
}
export function timelineY(value,series,height){return 4+(series.max-value)/(series.max-series.min)*(height-8);}
export function readTimelineSelection(value){
 if(!Array.isArray(value))return Object.keys(TIMELINE_SERIES);
 return Object.keys(TIMELINE_SERIES).filter(key=>value.includes(key));
}
