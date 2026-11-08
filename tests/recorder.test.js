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
