import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Recorder} from '../src/recorder.js';
test('valid GPS updates notify tracking without waiting for IMU samples; poor fixes are ignored',async()=>{
 globalThis.window={addEventListener(){}};
 globalThis.document={addEventListener(){}};
 let positionCallback,cleared=false;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{watchPosition(callback){positionCallback=callback;return 7;},clearWatch(id){assert.equal(id,7);cleared=true;}}}});
 const fixes=[],samples=[];
 const recorder=new Recorder(ride=>samples.push(ride),()=>{},()=>{},fix=>fixes.push(fix));
 recorder.motion({accelerationIncludingGravity:{x:0,y:9.8,z:0},acceleration:{x:0,y:0,z:0}});
 recorder.calibrate();await recorder.start();
 try{
  const fix=(latitude,accuracy)=>({timestamp:Date.now(),coords:{latitude,longitude:139,accuracy,altitude:0,speed:10,heading:0}});
  positionCallback(fix(35,100));assert.equal(fixes.length,0);
  positionCallback(fix(35,5));positionCallback(fix(35.001,5));
  assert.deepEqual(fixes.map(f=>f.coords.latitude),[35,35.001]);assert.equal(samples.length,0);
  recorder.motion({accelerationIncludingGravity:{x:0,y:9.8,z:0},acceleration:{x:0,y:0,z:0}});
  assert.equal(samples.length,1);assert.equal(samples[0].samples[0].latitude,35.001);
 }finally{recorder.stop();}
 assert.ok(cleared);assert.equal(recorder.active,false);
});
test('sensor preview works before calibration and recording, without GPS or saved samples',()=>{
 globalThis.window={addEventListener(){}};globalThis.document={addEventListener(){}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
 const previews=[],samples=[];
 const recorder=new Recorder(ride=>samples.push(ride),()=>{},()=>{},()=>{},motion=>previews.push(motion));
 const event={accelerationIncludingGravity:{x:4.9,y:8.487,z:0},acceleration:{x:0,y:0,z:0}};
 recorder.motion(event);
 assert.equal(previews.length,1);assert.ok(Math.abs(previews[0].lean+30)<0.01);
 assert.equal(previews[0].calibrated,false);assert.equal(recorder.active,false);
 assert.equal(recorder.ride,undefined);assert.equal(samples.length,0);
 recorder.calibrate();recorder.previewTime=-Infinity;recorder.motion(event);
 assert.equal(previews[1].calibrated,true);assert.ok(Math.abs(previews[1].lean)<0.001);
 recorder.previewTime=-Infinity;recorder.motion({accelerationIncludingGravity:{x:0,y:8,z:4},acceleration:null});
 assert.equal(previews[2].acceleration,null);assert.ok(Math.abs(previews[2].pitch)>20);
 recorder.previewTime=-Infinity;recorder.motion({accelerationIncludingGravity:{x:null,y:8,z:4},acceleration:null});
 assert.equal(previews.length,3);
});
