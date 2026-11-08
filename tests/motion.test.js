import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PositionTween,interpolatePosition,angleDelta,courseBetween,resolveHeading} from '../src/motion.js';
const a={latitude:35,longitude:139,bearing:350},b={latitude:35.01,longitude:139.02,bearing:10};
test('position and bearing interpolate together and finish at the measured target',()=>{
 const tween=new PositionTween();tween.set(a,0,0);tween.set(b,100,200);
 assert.deepEqual(tween.at(100),a);assert.ok(Math.abs(tween.at(200).latitude-35.005)<1e-10);
 assert.equal(tween.at(200).bearing,360);assert.equal(tween.running(299),true);assert.equal(tween.running(300),false);
 assert.equal(tween.at(300).latitude,b.latitude);assert.ok(Math.abs(angleDelta(tween.at(300).bearing,b.bearing))<1e-8);
});
test('mid-animation retarget is continuous; duplicate targets do not restart motion',()=>{
 const tween=new PositionTween();tween.set(a,0);tween.set(b,10,100);
 const visible=tween.at(60);tween.set({...b,latitude:36},60,100);
 assert.deepEqual(tween.at(60),visible);assert.equal(tween.set({...b,latitude:36},80,100),false);
 assert.equal(tween.at(160).latitude,36);
});
test('heading wraps via the shortest path and missing GPS headings can use geographic course',()=>{
 assert.equal(angleDelta(359,1),2);assert.equal(angleDelta(1,359),-2);
 assert.equal(interpolatePosition({...a,longitude:179}, {...b,longitude:-179},0.5).longitude,180);
 assert.ok(Math.abs(courseBetween({latitude:35,longitude:139},{latitude:35,longitude:139.01})-90)<0.01);
});

test('heading holds at low speed and missing headings accumulate enough distance before rotation',()=>{
 const point={latitude:35,longitude:139};
 assert.equal(resolveHeading({...point,speed:0,heading:270},90,point).heading,90);
 const near=resolveHeading({...point,longitude:139.00001,speed:10,heading:null},25,point);
 assert.equal(near.heading,25);assert.deepEqual(near.anchor,point);
 const moved=resolveHeading({...point,longitude:139.0001,speed:10,heading:null},near.heading,near.anchor);
 assert.ok(Math.abs(moved.heading-90)<0.01);
 assert.equal(resolveHeading({...point,speed:10,course:360},90,point).heading,0);
});
