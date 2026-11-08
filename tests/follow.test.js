import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncFollow} from '../src/follow.js';
test('playback camera follows each selected log location, not an old live GPS fix',()=>{
 const centers=[],map={centerLocation:(fix,initial)=>centers.push([fix.coords,initial])};
 const staleFix={coords:{latitude:1,longitude:2}};
 const samples=[{latitude:35,longitude:139},{latitude:35.01,longitude:139.02}];
 for(const sample of samples)syncFollow(map,{enabled:true,recording:false,sample,fix:staleFix,initial:true});
 assert.deepEqual(centers,samples.map(s=>[s,false]));
});
test('follow off leaves the camera alone; recording follows GPS and waits for a fix',()=>{
 const calls=[],map={centerLocation:(...args)=>calls.push(args)};
 const sample={latitude:35,longitude:139},fix={coords:{latitude:36,longitude:140}};
 assert.equal(syncFollow(map,{enabled:false,recording:false,sample}),false);
 assert.equal(syncFollow(map,{enabled:true,recording:true,sample,fix:null}),false);
 assert.equal(syncFollow(map,{enabled:true,recording:false,sample:null,fix}),false);
 assert.equal(calls.length,0);
 assert.equal(syncFollow(map,{enabled:true,recording:true,sample,fix,initial:true}),true);
 assert.deepEqual(calls,[[fix,true]]);
});
