import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackClock,RidePlayback} from '../src/playback.js';
const sample=(ms,longitude=139,segment=0)=>({time:new Date(ms).toISOString(),latitude:35,longitude,segment,course:0,speed:10,lean:ms/100,acceleration:{x:ms/1000,y:0,z:0}});
test('real-time clock supports fractional speeds, mid-play rate changes, pause and resume',()=>{
 const c=new PlaybackClock();c.play(0);assert.equal(c.current(1000),1000);
 c.setRate(1.25,1000);assert.equal(c.current(1800),2000);
 c.pause(1800);assert.equal(c.current(5000),2000);c.play(5000);assert.equal(c.current(5800),3000);
 c.setRate(0.5,5800);assert.equal(c.current(6800),3500);
 for(const rate of [0,NaN,-1,101])assert.throws(()=>c.setRate(rate,6800));
});
test('repeated GPS fixes interpolate over the entire GPS interval, not the last IMU interval',()=>{
 const samples=Array.from({length:21},(_,i)=>sample(i*100,i<10?139:i<20?139.001:139.002));
 const data=new RidePlayback(samples);
 const a=data.frame(200),b=data.frame(400),c=data.frame(600);
 assert.ok(a.sample.longitude<b.sample.longitude && b.sample.longitude<c.sample.longitude);
 assert.ok(Math.abs(b.sample.longitude-139.0004)<1e-8);assert.equal(b.index,4);
 assert.ok(Math.abs(data.frame(450).sample.lean-4.5)<1e-8);
 assert.equal(data.duration,2000);assert.equal(data.frame(3000).index,20);
});
test('uneven timestamps and sub-sample frames preserve measured time and heading wrap',()=>{
 const a=sample(0),b=sample(1000,139.001),c=sample(4000,139.002);a.course=359;b.course=1;
 const data=new RidePlayback([a,b,c]);assert.equal(data.timeAtIndex(1.5),2500);
 const frame=data.frame(500);assert.equal(frame.index,0.5);assert.ok(Math.abs(frame.sample.course-360)<1e-8);
 assert.equal(Date.parse(frame.sample.time),500);
});
test('recording pause gaps are excluded and positions are not interpolated across segments',()=>{
 const data=new RidePlayback([sample(0),sample(1000,139.001),sample(601000,140,1),sample(602000,140.001,1)]);
 assert.equal(data.duration,2000);
 assert.ok(data.frame(900).sample.longitude<139.01);
 assert.equal(data.frame(1000).sample.longitude,140);
 assert.ok(data.frame(1500).sample.longitude>140);
});
