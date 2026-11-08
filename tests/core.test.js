import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calibrate,measure,demoRide,validateRide,distance,color,destination} from '../src/core.js';
test('portrait mount: zero and signed lean, vehicle acceleration axes',()=>{
 const basis=calibrate([0,-9.80665,0]);
 for(const deg of [-45,0,45]){const r=deg*Math.PI/180;const result=measure([9.80665*Math.sin(r),-9.80665*Math.cos(r),0],[1,2,-3],basis);assert.ok(Math.abs(result.lean-deg)<1e-8);assert.deepEqual(result.acceleration,{x:1,y:3,z:2});}
 assert.throws(()=>calibrate([0,0,-9.8]));assert.equal(measure([0,-9.8,0],null,basis).acceleration,null);
});
test('demo and import round trip preserves route, rejects malformed input',()=>{
 const ride=demoRide(),loaded=validateRide(JSON.parse(JSON.stringify(ride)));
 assert.equal(loaded.samples.length,420);assert.ok(distance(loaded.samples)>5000);assert.notEqual(loaded.id,ride.id);
 const corrupt=structuredClone(ride);corrupt.samples[0].latitude=95;assert.throws(()=>validateRide(corrupt));
 const invalid=structuredClone(ride);invalid.samples[0].acceleration.x='1';assert.throws(()=>validateRide(invalid));
 assert.throws(()=>validateRide({...ride,samples:[]}));
 const reversed=structuredClone(ride);reversed.samples.reverse();assert.throws(()=>validateRide(reversed));
});
test('Swift reference-date import and missing sensor data',()=>{
 const ride=demoRide();ride.startedAt=0;ride.samples=[{...ride.samples[0],time:0,acceleration:null,speed:null,lean:null}];
 const loaded=validateRide(ride);assert.equal(loaded.startedAt,'2001-01-01T00:00:00.000Z');assert.equal(color(loaded.samples[0],'speed'),'#768296');
});
test('geographic acceleration projection uses heading clockwise from north',()=>{
 const [east,lat]=destination(35,139,90,100);assert.ok(east>139);assert.ok(Math.abs(lat-35)<1e-8);
 const [lon,north]=destination(35,139,0,100);assert.equal(lon,139);assert.ok(north>35);
});
