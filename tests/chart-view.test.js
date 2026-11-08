import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChartView} from '../src/chart-view.js';
import {timelineSeries} from '../src/timeline.js';
test('zoom preserves pointer anchor and constrains panning and maximum detail',()=>{
 const view=new ChartView();view.zoom(4,0.3,0.5,'x',0.01);
 assert.ok(Math.abs(view.position(0.3)-0.3)<1e-10);assert.equal(view.width,0.25);
 view.pan(100);assert.equal(view.x,0.75);view.pan(-100);assert.equal(view.x,0);
 view.zoom(10000,0.5,0.5,'x',0.01);assert.equal(view.width,0.01);
 view.zoom(0.0001,0.5,0.5,'x',0.01);assert.equal(view.width,1);assert.equal(view.x,0);
});
test('vertical and pinch zooms preserve independent physical axis windows',()=>{
 const view=new ChartView();view.zoom(2,0.5,0.75,'both',0.01);
 assert.equal(view.width,0.5);assert.equal(view.height,0.5);assert.equal(view.y,0.375);
 view.pan(0,100);assert.equal(view.y,0.5);
 view.reset();assert.deepEqual(view.snapshot(),{x:0,width:1,y:0,height:1});
});
test('seek mapping, reset and playback reveal remain consistent after zoom',()=>{
 const view=new ChartView();view.zoom(4,0.5,0.5,'x',0.01);
 assert.equal(view.position(0),0.375);assert.equal(view.fraction(0.5),0.5);
 assert.equal(view.reveal(0.5),false);assert.equal(view.reveal(0.95),true);
 assert.ok(view.fraction(0.95)>=0 && view.fraction(0.95)<=1);
});
test('zoomed rendering retains local detail rather than reusing coarse full-log points',()=>{
 const samples=Array.from({length:10000},(_,index)=>({lean:Math.sin(index),speed:10,acceleration:null}));
 const view=timelineSeries(samples,'lean',200,{start:1200,end:1220,min:-60,max:60});
 assert.ok(view.points.some(p=>p?.index===1205));
 assert.ok(view.points.every(p=>p===null || p.index>=1199&&p.index<=1221));
 assert.equal(view.min,-60);assert.equal(view.max,60);
});
