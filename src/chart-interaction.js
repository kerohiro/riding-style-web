export const chartControlsMarkup=`<div class="chart-view-controls" role="group" aria-label="グラフの拡大と移動"><button id="chart-left" aria-label="表示区間を前へ移動">←</button><button id="chart-zoom-out" aria-label="横軸を縮小">−</button><label>横倍率 <input id="chart-zoom" type="number" value="1" min="1" step="any" aria-label="グラフの横倍率">×</label><button id="chart-zoom-in" aria-label="横軸を拡大">＋</button><button id="chart-right" aria-label="表示区間を後へ移動">→</button><label>縦倍率 <input id="chart-yzoom" type="number" value="1" min="1" max="100" step="any" aria-label="グラフの縦倍率">×</label><button id="chart-center">選択位置へ</button><button id="chart-reset">全体表示</button></div><div class="chart-window-info"><span id="chart-window" role="status"></span><span id="chart-outside" hidden>選択位置は表示区間外です</span><label><input id="chart-follow" type="checkbox">再生位置に追従</label></div><p class="chart-gesture-hint">ホイール：横拡大 ／ Shift＋ホイール：縦拡大 ／ ドラッグ：移動 ／ ピンチ：両軸拡大</p>`;
export function mountChartInteraction({view,minWidth,onDraw,onSeek,getPosition,onError}){
 const $=id=>document.getElementById(id),canvas=$('chart'),pointers=new Map();let gesture=null,moved=false;
 const manual=()=>{$('chart-follow').checked=false;};
 const zoom=(factor,axis='x',x,y=0.5)=>{const position=view.fraction(getPosition());view.zoom(factor,x??(position>=0&&position<=1?position:0.5),y,axis,minWidth());onDraw();};
 const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 const begin=()=>{
  const points=[...pointers.values()],snapshot=view.snapshot();
  if(points.length>=2){const [a,b]=points;gesture={snapshot,center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),pinch:true};moved=true;}
  else if(points.length)gesture={snapshot,start:points[0],pinch:false};
 };
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.setPointerCapture(e.pointerId);if(!pointers.size)moved=false;pointers.set(e.pointerId,local(e));begin();});
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,local(e));const points=[...pointers.values()],g=gesture;
  if(g.pinch && points.length>=2){
   const [a,b]=points,center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},ratio=Math.max(0.01,Math.hypot(a.x-b.x,a.y-b.y)/g.distance);
   const width=Math.max(minWidth(),Math.min(1,g.snapshot.width/ratio)),height=Math.max(0.01,Math.min(1,g.snapshot.height/ratio));
   view.set({x:g.snapshot.x+g.center.x/canvas.clientWidth*g.snapshot.width-center.x/canvas.clientWidth*width,y:g.snapshot.y+g.center.y/canvas.clientHeight*g.snapshot.height-center.y/canvas.clientHeight*height,width,height},minWidth());
  }else {
   const dx=points[0].x-g.start.x,dy=points[0].y-g.start.y;if(Math.hypot(dx,dy)>5)moved=true;if(!moved)return;
   view.set({...g.snapshot,x:g.snapshot.x-dx/canvas.clientWidth*g.snapshot.width,y:g.snapshot.y-dy/canvas.clientHeight*g.snapshot.height},minWidth());
  }
  manual();onDraw();
 });
 const finish=(e,cancelled=false)=>{
  if(!pointers.has(e.pointerId))return;const point=local(e),tap=!moved&&pointers.size===1&&!cancelled;pointers.delete(e.pointerId);
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(tap)onSeek(view.position(point.x/canvas.clientWidth));
  if(pointers.size){moved=true;begin();}else gesture=null;
 };
 canvas.addEventListener('pointerup',e=>finish(e));canvas.addEventListener('pointercancel',e=>finish(e,true));
 canvas.addEventListener('wheel',e=>{
  e.preventDefault();const p=local(e);manual();
  if(Math.abs(e.deltaX)>Math.abs(e.deltaY) && !e.ctrlKey)view.pan(e.deltaX/canvas.clientWidth);
  else {const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);zoom(Math.exp(-Math.max(-200,Math.min(200,delta))*0.006),e.ctrlKey?'both':e.shiftKey?'y':'x',p.x/canvas.clientWidth,p.y/canvas.clientHeight);}
  onDraw();
 },{passive:false});
 canvas.addEventListener('dblclick',()=>{view.reset();onDraw();});
 canvas.addEventListener('keydown',e=>{
  if(!['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();
  if(e.key==='Home')view.reset();else if(['+','=','-'].includes(e.key))zoom(e.key==='-'?0.5:2,e.altKey?'y':'x');
  else {view.pan(e.key==='ArrowLeft'?-0.25:e.key==='ArrowRight'?0.25:0,e.key==='ArrowUp'?-0.25:e.key==='ArrowDown'?0.25:0);manual();}
  onDraw();
 });
 $('chart-zoom-in').onclick=()=>zoom(2);$('chart-zoom-out').onclick=()=>zoom(0.5);
 $('chart-left').onclick=()=>{manual();view.pan(-0.5);onDraw();};$('chart-right').onclick=()=>{manual();view.pan(0.5);onDraw();};
 $('chart-reset').onclick=()=>{view.reset();onDraw();};$('chart-center').onclick=()=>{view.set({...view.snapshot(),x:getPosition()-view.width/2},minWidth());onDraw();};
 $('chart-follow').onchange=()=>{if($('chart-follow').checked)view.reveal(getPosition());onDraw();};
 for(const [id,axis,max] of [['chart-zoom','x',()=>1/minWidth()],['chart-yzoom','y',()=>100]]){
  const apply=()=>{const value=Number($(id).value);if(!Number.isFinite(value)||value<1||value>max()){onError(`倍率は1〜${Math.floor(max())}で指定してください`);onDraw();return;}zoom(value*(axis==='x'?view.width:view.height),axis);};
  $(id).onchange=apply;$(id).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();apply();}};
 }
}
