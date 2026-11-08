import {test} from 'node:test';
import assert from 'node:assert/strict';
import {timelineSeries,timelineY,readTimelineSelection} from '../src/timeline.js';
const sample=(lean=0,speed=10,acceleration={x:3,y:4,z:0},segment=0)=>({lean,speed,acceleration,segment});
test('overlay series use their own physical units and signed lean scale',()=>{
 const samples=[sample(-30,10),sample(45,20)];
 const lean=timelineSeries(samples,'lean'),speed=timelineSeries(samples,'speed'),acc=timelineSeries(samples,'acceleration');
 assert.deepEqual(lean.points.map(p=>p.value),[-30,45]);assert.equal(lean.min,-60);assert.equal(lean.max,60);
 assert.deepEqual(speed.points.map(p=>p.value),[36,72]);assert.equal(speed.min,0);assert.ok(speed.max>=72);
 assert.deepEqual(acc.points.map(p=>p.value),[5,5]);assert.equal(acc.unit,'m/s²');
 assert.equal(timelineY(0,lean,180),90);assert.equal(timelineY(0,speed,180),176);
 assert.equal(timelineY(lean.max,lean,180),4);
});
test('display decimation preserves narrow peaks and troughs in dense logs',()=>{
 const samples=Array.from({length:1000},()=>sample(0));samples[123].lean=80;samples[124].lean=-70;
 const series=timelineSeries(samples,'lean',10);
 assert.ok(series.points.some(p=>p?.index===123&&p.value===80));
 assert.ok(series.points.some(p=>p?.index===124&&p.value===-70));assert.ok(series.max>=80);assert.ok(series.points.length<100);
});
test('missing values and recording pauses break lines, rather than drawing artificial connections',()=>{
 const samples=[sample(10),sample(null),sample(20),sample(30,10,null,1)];
 const lean=timelineSeries(samples,'lean',1);
 assert.deepEqual(lean.points.map(p=>p?.value??null),[10,null,20,null,30]);
 const acc=timelineSeries([sample(null,null,null)],'acceleration');
 assert.equal(acc.hasData,false);assert.equal(acc.min,0);assert.ok(Number.isFinite(acc.max));
});
test('selection restores valid preferences, including all-off and unknown-key filtering',()=>{
 assert.deepEqual(readTimelineSelection(null),['lean','speed','acceleration']);
 assert.deepEqual(readTimelineSelection([]),[]);
 assert.deepEqual(readTimelineSelection(['speed','unknown','speed']),['speed']);
});
