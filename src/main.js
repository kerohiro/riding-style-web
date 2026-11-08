import './style.css';
import {leanGaugeMarkup,renderLeanCard} from './lean-gauge.js';
import {demoRide,validateRide,distance,magnitude,DEFAULT_RANGES,validateRanges} from './core.js';
import {saveRide,listRides,deleteRide} from './storage.js';
import {Recorder} from './recorder.js';
import {RideMap} from './maps.js';
import {Pose} from './pose.js';
import {syncFollow} from './follow.js';
import {PlaybackClock,RidePlayback} from './playback.js';
import {TIMELINE_SERIES,timelineSeries,timelineY,readTimelineSelection} from './timeline.js';
const $=id=>document.getElementById(id);
document.querySelector('#app').innerHTML=`
<header><a class="brand" href="./"><span class="brand-mark">↗</span> RIDE<span>ATLAS</span></a><div class="header-right"><span class="live-dot"></span><span>RIDING STYLE ANALYSIS</span><button id="settings" class="icon-button" aria-label="表示・地図設定">⚙</button></div></header>
<main><section class="intro"><div><div class="eyebrow">EVERY CORNER TELLS A STORY</div><h1>走りを、立体で読み解く。</h1><p>ライン、加速、リーン。その瞬間を、もう一度。</p></div><button id="library" class="secondary">▤ 走行ライブラリ</button></section>
<div class="workspace"><section class="map-panel"><div class="map-toolbar"><div class="tabs" role="group" aria-label="軌跡の色分け"><button data-metric="speed" class="active">速度</button><button data-metric="acceleration">加速度</button><button data-metric="lean">リーン角</button></div><div class="map-actions"><button id="pitch" aria-label="地図の傾きを切替">3D</button><button id="fit" aria-label="走行全体を表示">⛶</button><button id="focus" aria-label="選択位置へ移動">⌖</button></div></div><button id="follow" class="follow-control" aria-pressed="true">◎ 現在地追従 ON</button><label class="orientation-control" for="orientation">地図の向き <select id="orientation" aria-label="地図の向き"><option value="north">北を上</option><option value="heading">進行方向を上</option></select></label><div id="map"></div><div id="map-warning" hidden></div><div class="map-badge"><span class="live-dot"></span><span id="ride-kind">DEMO ROUTE</span><span class="badge-divider">/</span><span id="map-provider">OPENSTREETMAP</span></div><div class="map-caption">橙の矢印：水平加速度　柱の高さ：|リーン角| × 2 m（模式表示）</div><div class="map-legend"><span id="legend-title">SPEED</span><div class="gradient"></div><span id="legend-range">0 — 120 km/h</span></div></section>
<aside><div class="panel ride-overview"><div class="section-label">SELECTED RIDE <span id="demo-tag">DEMO</span></div><h2 id="ride-name"></h2><div class="overview-meta"><span id="ride-distance"></span><span id="ride-duration"></span></div></div>
<div class="stats"><div class="stat"><span>速度</span><strong id="speed">—</strong><small>km/h</small></div><div class="stat lean-stat" id="lean-card" role="img" aria-label="推定リーン角 データなし" data-valid="false"><span id="lean-label">リーン角・推定</span>${leanGaugeMarkup()}<strong id="lean">—</strong><small>deg</small></div><div class="stat"><span>合成加速度</span><strong id="accel">—</strong><small>m/s²</small></div></div>
<div class="panel pose-panel"><div class="section-label">3D TELEMETRY <span>車体座標</span></div><div class="telemetry-modes" role="group" aria-label="3Dテレメトリの表示元"><button id="telemetry-ride" aria-pressed="true">走行データ</button><button id="telemetry-sensor" aria-pressed="false">センサー確認</button></div><p id="telemetry-status" role="status">走行データの姿勢を表示中</p><div id="pose"></div><div class="pose-key"><span>● 車体姿勢</span><span>● 加速度ベクトル</span><span>ドラッグで回転</span></div><div class="vector-values"><div>左右 <b id="ax">—</b></div><div>前後 <b id="ay">—</b></div><div>上下 <b id="az">—</b></div></div><p class="direction" id="direction">水平向き — / 仰角 —</p></div>
</aside></div>
<section class="panel timeline"><div class="timeline-title"><div><span class="section-label">RIDE TIMELINE</span><span id="sample-time"></span></div><div class="playback-controls"><label for="playback-rate">再生倍率 <input id="playback-rate" type="number" min="0.01" max="100" step="any" value="1" aria-label="再生倍率"> ×</label><button id="play" class="secondary small">▶ 再生</button></div></div><fieldset class="chart-series-controls"><legend>グラフの表示項目</legend><label style="--series-color:#54efbd"><input type="checkbox" aria-label="リーン角を表示" data-chart-series="lean" checked> <span class="series-line"></span>リーン角（°）<small id="chart-value-lean"></small></label><label style="--series-color:#65baff"><input type="checkbox" aria-label="速度を表示" data-chart-series="speed" checked> <span class="series-line dashed"></span>速度（km/h）<small id="chart-value-speed"></small></label><label style="--series-color:#ffb567"><input type="checkbox" aria-label="合成加速度を表示" data-chart-series="acceleration" checked> <span class="series-line dotted"></span>合成加速度（m/s²）<small id="chart-value-acceleration"></small></label></fieldset><div class="chart-description">縦軸：色ごとの独立目盛（リーン角は＋右／−左）<span>横軸：走行サンプル順</span></div><p class="chart-scale-note">目盛はログ全体から自動調整。高さが同じでも、異なる項目の数値が同じとは限りません。</p><p id="playback-position" class="playback-position">1× / 0.00秒</p><div class="chart-layout"><div id="chart-axes" class="chart-axes" aria-label="表示項目ごとの縦軸目盛"></div><canvas id="chart" aria-label="リーン角・速度・合成加速度の重ね合わせグラフ"></canvas><div id="chart-cursor" aria-hidden="true"></div></div><input type="range" id="timeline" min="0" value="0" step="any" aria-label="走行位置"><div class="timeline-endpoints"><span>START <b id="start-time"></b></span><span>タイムライン・地図上の軌跡を選んで詳細を表示</span><span>FINISH <b id="end-time"></b></span></div></section>
<section class="panel recorder"><div class="recorder-copy"><span class="section-label">RECORD YOUR NEXT RIDE</span><h2>次の走りを記録する。</h2><p id="status" role="status">iPhoneを車体に縦向き・画面をライダー側に固定してください。</p></div><div class="record-buttons"><button id="permission" class="secondary">① センサーを許可</button><button id="calibrate" class="secondary">② 直立基準を設定</button><button id="record" class="primary">● 記録開始</button><button id="pause-recording" class="secondary" hidden>Ⅱ 記録を一時中断</button><button id="stop" class="danger" hidden>■ 終了して保存</button></div></section>
<div class="bottom-actions"><button id="save" class="text-button">↓ この走行を保存</button><button id="export" class="text-button">↗ JSONを書き出す</button><label class="text-button import-label">＋ JSONを読み込む<input type="file" id="import" accept=".json,application/json" hidden></label><a id="apple-link" target="_blank" rel="noopener">Apple Mapで位置を開く ↗</a></div>
<details class="notes"><summary>計測方法・精度・データの保存について</summary><p>停車して車体を直立させ、センサー許可 → 直立基準 → 記録開始の順に操作します。端末は縦向き、背面を前方、画面をライダー側に固定してください。基準設定後は取付方向を変えないでください。</p><p>計測は画面表示中のみ。計測中に画面ロック・別タブ・他アプリへ移動すると停止し、保存を試みます。一時中断中はページが保持されていれば、戻って同じログへ再開できます。再読込・ブラウザ強制終了後の同一ログへの記録再開は未対応です。ブラウザ強制終了時の完全保存は保証できないため、JSONも書き出してください。保存先はこのブラウザのIndexedDBで、別端末とは同期されません。プライベートブラウズやサイトデータ削除で消えることがあります。</p><p>リーン角は推定値で、旋回加速度・振動やブラウザのセンサー融合による誤差があります。実車での精度は未検証です。加速度は重力除去済み値を使用し、非対応時は「—」。GPS速度や進行方向が取得できない場合も「—」となります。GPSは直近3秒以内・水平精度50 m以内の測位を最大10 HzのIMUサンプルに紐付けます。独立した10 Hz GPS測位ではありません。</p><p>地図の柱はリーン角の大きさを示す模式表示で、車体の実寸や高度を示しません。加速度の矢印は車体の前後・左右成分をGPS進行方向で水平地図へ投影した参考表示です。仰角とリーン姿勢は右の3Dモデルで確認してください。Google Mapsの傾斜表示は地域・ズーム・地図仕様に依存します。</p><p>走行データはGitHubやサーバーへ送信しません。地図閲覧ではOpenStreetMapまたはGoogleへ通常の通信が発生します。走行中は操作せず、停車して確認してください。</p></details>
<footer><span>RIDE ATLAS</span><span>GPS + IMU / BUILT FOR THE CURVES</span></footer></main>
<dialog id="library-dialog"><div class="dialog-title"><h2>走行ライブラリ</h2><button class="icon-button" data-close="library-dialog" aria-label="閉じる">×</button></div><p>この端末・ブラウザに保存した走行</p><div id="ride-list"></div><button id="demo" class="secondary">デモ走行を開く</button></dialog>
<dialog id="settings-dialog"><div class="dialog-title"><h2>表示・地図設定</h2><button class="icon-button" data-close="settings-dialog" aria-label="閉じる">×</button></div><form id="range-form"><h3>ヒートマップの色分け範囲</h3><p>下限以下は青、上限以上は赤で表示します。リーン角は左右共通の絶対値です。</p><div class="range-grid"><span>指標</span><span>下限</span><span>上限</span>
<label for="speed-min">速度（km/h）</label><input type="number" id="speed-min" min="0" step="any" required aria-label="速度（km/h）の下限"><input type="number" id="speed-max" min="0" step="any" required aria-label="速度（km/h）の上限"><label for="acceleration-min">加速度（m/s²）</label><input type="number" id="acceleration-min" min="0" step="any" required aria-label="加速度（m/s²）の下限"><input type="number" id="acceleration-max" min="0" step="any" required aria-label="加速度（m/s²）の上限"><label for="lean-min">リーン角（°）</label><input type="number" id="lean-min" min="0" step="any" required aria-label="リーン角（°）の下限"><input type="number" id="lean-max" min="0" step="any" required aria-label="リーン角（°）の上限"></div><div class="range-buttons"><button type="submit" class="primary">色分け設定を保存</button><button type="button" id="reset-ranges" class="secondary">初期値に戻す</button></div><p id="range-status" role="status"></p></form><h3>地図プロバイダー</h3><p>標準地図はキー不要です。Google Mapsには、ご自身のGoogle CloudでMaps JavaScript APIと課金を有効化したキーが必要です。</p><label for="google-key">Google Maps APIキー</label><input type="password" id="google-key" placeholder="AIza…" autocomplete="off"><p class="muted">キーはこのブラウザに保存します。Google Cloudで利用元URLをこのサイトに制限してください。キーはリポジトリに含めません。</p><button id="google" class="primary">Google Mapsに切り替え</button><button id="openmap" class="secondary">標準地図に戻す</button><p id="google-error" role="status"></p></dialog><div id="toast" role="status" hidden></div>`;
let ride=demoRide(),previousRide=null,index=90,metric='speed',playing=null,lastRender=0,lastCheckpoint=0,saving=Promise.resolve();
let map,pose,latestFix=null,follow=true,firstFix=true,telemetryMode='ride',liveMotion=null,sensorError=null;
const playbackClock=new PlaybackClock();let playbackData=new RidePlayback(ride.samples),playbackRide=ride,playbackCount=ride.samples.length,playbackFrame=null,playbackRAF=null,lastPlaybackUI=0,lastPlaybackOverlay=0;
let chartSelection=Object.keys(TIMELINE_SERIES),chartGeometry={left:0,width:1};
try{const stored=localStorage.getItem('ride-timeline-series');if(stored)chartSelection=readTimelineSelection(JSON.parse(stored));}catch{}
for(const input of document.querySelectorAll('[data-chart-series]'))input.checked=chartSelection.includes(input.dataset.chartSeries);
let ranges=structuredClone(DEFAULT_RANGES);
try {const stored=localStorage.getItem('ride-color-ranges');if(stored)ranges=validateRanges(JSON.parse(stored));}catch{}
function updateLegend(){
 $('legend-title').textContent={speed:'SPEED',acceleration:'ACCELERATION',lean:'LEAN ANGLE'}[metric];
 const r=ranges[metric];$('legend-range').textContent=`${r.min} — ${r.max} ${{speed:'km/h',acceleration:'m/s²',lean:'°（絶対値）'}[metric]}`;
}
function updateFollowLabel(){
 $('follow').setAttribute('aria-pressed',String(follow));
 $('follow').textContent=`◎ ${recorder.active?'現在地':'再生位置'}追従 ${follow?'ON':'OFF'}`;
}
function updateMapTracking(){map?.setTracking({enabled:follow,recording:recorder.active,duration:recorder.active?600:200,playback:!!playing});}
function followPosition(){
 updateMapTracking();
 if(syncFollow(map,{enabled:follow,recording:recorder.active,sample:playing?playbackFrame?.sample:ride.samples[Math.floor(index)],fix:latestFix,initial:firstFix}) && recorder.active)firstFix=false;
}
function setFollow(enabled){
 follow=enabled;updateFollowLabel();followPosition();
}

function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,6000);}
function status(text){$('status').textContent=text;}
try {map=new RideMap($('map'),i=>{if(recorder.active)return;stopPlayback();index=i;setTelemetryMode('ride');renderSelected();},text=>{$('map-warning').textContent=text;$('map-warning').hidden=false;});} catch(e){$('map').textContent='3D地図を起動できません。このブラウザでWebGLを有効にしてください。';}
map?.setRanges(ranges);updateLegend();
try{pose=new Pose($('pose'));}catch{$('pose').textContent='3D表示にはWebGL対応ブラウザが必要です。数値データは下に表示します。';}
function queueSave(value,quiet=false){
 if(!value.samples.length){if(!quiet)notify('保存できる走行サンプルがありません');return Promise.resolve();}
 const snapshot=structuredClone(value);
 saving=saving.catch(()=>{}).then(()=>saveRide(snapshot)).then(()=>{if(!quiet)notify('走行を端末に保存しました');}).catch(e=>{notify('保存できませんでした。JSONを書き出してください。'+e.message);});
 return saving;
}
const recorder=new Recorder(value=>{
 ride=value;index=ride.samples.length-1;
 if(performance.now()-lastRender>500){render();lastRender=performance.now();}
 if(Date.now()-lastCheckpoint>5000){lastCheckpoint=Date.now();queueSave(ride,true);}
},status,value=>{
 if(value.samples.length){ride=value;index=Math.max(0,ride.samples.length-1);queueSave(ride);render();}
 else {if(previousRide){ride=previousRide;index=0;render();}notify('有効なGPS・IMUサンプルがないため保存しませんでした');}
 setRecording(false);
},fix=>{
 latestFix=fix;
 followPosition();
},motion=>{
 liveMotion=motion;sensorError=null;
 if(recorder.active && !recorder.paused)renderLeanCard(motion.lean);
 if(telemetryMode==='sensor')renderLiveMotion();
});
const fmt=(v,d=1)=>v===null||v===undefined?'—':v.toFixed(d);
const signed=v=>v===null||v===undefined?'—':(v>=0?'+':'')+v.toFixed(2);
const time=v=>new Date(v).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
function setRecording(active){
 updateFollowLabel();
 for(const id of ['record','permission','library','save','import','play'])$(id).disabled=active;
 $('calibrate').disabled=active&&!recorder.paused;
 $('record').hidden=active;$('stop').hidden=!active;$('pause-recording').hidden=!active;$('pause-recording').textContent=recorder.paused?'▶ 記録を再開':'Ⅱ 記録を一時中断';$('timeline').disabled=active;$('playback-rate').disabled=active;
 $('ride-kind').textContent=active?(recorder.paused?'Ⅱ RECORDING PAUSED':'● LIVE RECORDING'):ride.isDemo?'DEMO ROUTE':'SAVED RIDE';
}
function render(){
 if(!recorder.active && (playbackRide!==ride || playbackCount!==ride.samples.length)){playbackData=new RidePlayback(ride.samples);playbackRide=ride;playbackCount=ride.samples.length;}

 $('ride-name').textContent=ride.name;$('demo-tag').textContent=ride.isDemo?'DEMO':'GPS + IMU';
 $('ride-distance').textContent=(distance(ride.samples)/1000).toFixed(2)+' km';
 const duration=ride.samples.length>1?(Date.parse(ride.samples.at(-1).time)-Date.parse(ride.samples[0].time))/1000:0;
 $('ride-duration').textContent=Math.floor(duration/60)+'分 '+Math.floor(duration%60)+'秒';
 $('timeline').max=Math.max(0,ride.samples.length-1);$('start-time').textContent=ride.samples.length?time(ride.samples[0].time):'—';$('end-time').textContent=ride.samples.length?time(ride.samples.at(-1).time):'—';
 setRecording(recorder.active);renderSelected();drawChart();
}
function renderSelected(){
 const frame=!recorder.active?playbackData.frame(playbackData.timeAtIndex(index)):null;
 const s=frame?.sample??ride.samples[Math.floor(index)];if(!s)return;
 if(frame){playbackFrame=frame;playbackClock.seek(frame.elapsed,performance.now());}
 updatePlaybackNumbers(s);
 updateMapTracking();map?.update(ride.samples,metric,Math.floor(index));
 if(frame)map?.showPlaybackFrame(s);else if(!recorder.active)followPosition();
 updatePlaybackCursor();
}
function updatePlaybackNumbers(s){
 $('speed').textContent=fmt(s.speed===null?null:s.speed*3.6,0);renderLeanCard(s.lean);
 $('accel').textContent=fmt(magnitude(s),2);
 if(telemetryMode==='ride')renderTelemetry(s);
 $('sample-time').textContent=time(s.time)+' / '+(Math.floor(index)+1)+'点目';
 $('apple-link').href=`https://maps.apple.com/?ll=${s.latitude},${s.longitude}&q=${encodeURIComponent('走行データの選択位置')}`;
 for(const [key,meta] of Object.entries(TIMELINE_SERIES))$('chart-value-'+key).textContent=fmt(meta.value(s),key==='acceleration'?2:1);
 $('playback-position').textContent=`${playbackClock.rate}× / ${((playbackFrame?.elapsed??0)/1000).toFixed(2)}秒 / ${(playbackData.duration/1000).toFixed(2)}秒`;
}
function updatePlaybackCursor(){
 $('timeline').value=index;
 $('chart-cursor').style.left=`${chartGeometry.left+chartGeometry.width*index/Math.max(1,ride.samples.length-1)}px`;
 $('chart-cursor').hidden=chartSelection.length===0;
}
function renderTelemetry(s){
 for(const [id,k] of [['ax','x'],['ay','y'],['az','z']])$(id).textContent=signed(s?.acceleration?.[k]);
 const a=s?.acceleration;
 $('direction').textContent=a&&Math.hypot(a.x,a.y,a.z)>0.05?`水平向き ${Math.atan2(a.x,a.y)*180/Math.PI|0}° / 仰角 ${Math.atan2(a.z,Math.hypot(a.x,a.y))*180/Math.PI|0}°`:'加速度方向 —';
 pose?.update(s);
}
function setTelemetryMode(mode){
 telemetryMode=mode;
 $('telemetry-ride').setAttribute('aria-pressed',String(mode==='ride'));
 $('telemetry-sensor').setAttribute('aria-pressed',String(mode==='sensor'));
 if(mode==='sensor'){stopPlayback();renderLiveMotion();}
 else { $('telemetry-status').textContent='走行データの姿勢を表示中';renderTelemetry(playbackFrame?.sample??ride.samples[Math.floor(index)]); }
}
function renderLiveMotion(){
 if(sensorError){$('telemetry-status').textContent=sensorError;return;}
 if(!liveMotion || performance.now()-liveMotion.receivedAt>2000){
  $('telemetry-status').textContent=liveMotion?'受信停止 • 端末のセンサー設定・画面表示を確認してください':'センサー受信待ち • 「センサーを許可」を押し、端末を動かしてください';
  if(!liveMotion)renderTelemetry(null);
  return;
 }
 renderTelemetry(liveMotion);
 $('telemetry-status').textContent=`● LIVE IMU • ${liveMotion.calibrated?'直立基準を使用':'未校正・端末縦向き基準'}${recorder.active?(recorder.paused?' • 記録中断中':' • 記録中'):' • 保存なし'}${liveMotion.acceleration?'':' • 線形加速度なし'}`;
}
setInterval(()=>{if(telemetryMode==='sensor')renderLiveMotion();},1000);
async function enableSensorPreview(){
 sensorError=null;setTelemetryMode('sensor');
 try {await recorder.enable();} catch(e){sensorError=e.message;$('telemetry-status').textContent=e.message;throw e;}
}
$('telemetry-sensor').onclick=()=>attempt(enableSensorPreview);
$('telemetry-ride').onclick=()=>setTelemetryMode('ride');
function drawChart(){
 const canvas=$('chart'),axes=$('chart-axes');
 // Scale columns belong to each series and are separate from the heatmap settings.
 const series=chartSelection.map(key=>timelineSeries(ride.samples,key,Math.max(1,canvas.clientWidth)));
 axes.replaceChildren();
 for(const entry of series){
  const column=document.createElement('div');column.className='chart-axis-column';column.style.color=entry.color;column.setAttribute('aria-label',`${entry.label}（${entry.unit}）の目盛`);
  const unit=document.createElement('span');unit.className='chart-axis-unit';unit.textContent=entry.unit;column.append(unit);
  for(let tick=0;tick<=4;tick++){
   const value=entry.max-(entry.max-entry.min)*tick/4,label=document.createElement('span');
   label.textContent=(entry.key==='lean'&&value>0?'+':'')+Number(value.toFixed(2));column.append(label);
  }
  axes.append(column);
 }
 const w=canvas.clientWidth,h=canvas.clientHeight,scale=Math.min(devicePixelRatio,2);canvas.width=w*scale;canvas.height=h*scale;
 chartGeometry={left:canvas.offsetLeft,width:w};$('timeline').style.width=w+'px';$('timeline').style.marginLeft=chartGeometry.left+'px';
 const c=canvas.getContext('2d');c.scale(scale,scale);c.clearRect(0,0,w,h);
 c.strokeStyle='#25323e';c.lineWidth=1;
 for(let tick=0;tick<=4;tick++){const y=4+(h-8)*tick/4;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 for(const entry of series){
  c.beginPath();c.strokeStyle=entry.color;c.lineWidth=1.6;c.setLineDash(entry.dash);let pen=false;
  for(const point of entry.points){if(point===null){pen=false;continue;}const x=point.index/Math.max(1,ride.samples.length-1)*w,y=timelineY(point.value,entry,h);if(pen)c.lineTo(x,y);else c.moveTo(x,y);pen=true;}
  c.stroke();
 }
 c.setLineDash([]);
 if(!series.length){c.fillStyle='#a9bac9';c.font='12px sans-serif';c.textAlign='center';c.fillText('表示する項目を選択してください',w/2,h/2);}
 canvas.setAttribute('aria-label',series.length?series.map(s=>`${s.label}（${s.unit}）${s.hasData?'':'・データなし'}`).join('、')+'の重ね合わせグラフ。縦軸は色ごとの独立目盛。':'表示項目なし');
 updatePlaybackCursor();
}
for(const input of document.querySelectorAll('[data-chart-series]'))input.onchange=()=>{
 chartSelection=Object.keys(TIMELINE_SERIES).filter(key=>document.querySelector(`[data-chart-series="${key}"]`).checked);
 try{localStorage.setItem('ride-timeline-series',JSON.stringify(chartSelection));}catch{notify('表示項目を変更しましたが、端末への保存に失敗しました');}
 drawChart();
};
new ResizeObserver(drawChart).observe($('chart'));
$('timeline').oninput=e=>{stopPlayback();setTelemetryMode('ride');index=Number(e.target.value);renderSelected();};
$('chart').onclick=e=>{if(recorder.active)return;stopPlayback();setTelemetryMode('ride');index=Math.round((e.offsetX/$('chart').clientWidth)*(ride.samples.length-1));renderSelected();};
function applyPlaybackFrame(frame,now,force=false){
 if(!frame)return;
 playbackFrame=frame;index=frame.index;renderLeanCard(frame.sample.lean);updateMapTracking();map?.showPlaybackFrame(frame.sample);
 if(telemetryMode==='ride')pose?.update(frame.sample);
 updatePlaybackCursor();
 if(force || now-lastPlaybackUI>=100){updatePlaybackNumbers(frame.sample);lastPlaybackUI=now;}
 if(force || now-lastPlaybackOverlay>=250){map?.update(ride.samples,metric,Math.floor(index));lastPlaybackOverlay=now;}
}
function stopPlayback(){
 if(playing){const now=performance.now();playbackClock.pause(now);applyPlaybackFrame(playbackData.frame(playbackClock.position),now,true);}
 cancelAnimationFrame(playbackRAF);playing=null;updateMapTracking();$('play').textContent='▶ 再生';
}
function playbackTick(now){
 if(!playing)return;
 const elapsed=Math.min(playbackData.duration,playbackClock.current(now));
 applyPlaybackFrame(playbackData.frame(elapsed),now);
 if(elapsed>=playbackData.duration){stopPlayback();return;}
 playbackRAF=requestAnimationFrame(playbackTick);
}
$('play').onclick=()=>{
 if(playing){stopPlayback();return;}
 try{playbackClock.setRate(Number($('playback-rate').value),performance.now());}catch(e){notify(e.message);return;}
 setTelemetryMode('ride');if(playbackClock.position>=playbackData.duration)playbackClock.seek(0,performance.now());
 playing=true;playbackClock.play(performance.now());setFollow(true);$('play').textContent='Ⅱ 停止';playbackRAF=requestAnimationFrame(playbackTick);
};
$('playback-rate').oninput=()=>{const rate=Number($('playback-rate').value);if(Number.isFinite(rate)&&rate>=0.01&&rate<=100){playbackClock.setRate(rate,performance.now());$('playback-position').textContent=`${rate}× / ${((playbackFrame?.elapsed??0)/1000).toFixed(2)}秒`;}};
$('playback-rate').onchange=()=>{
 try{playbackClock.setRate(Number($('playback-rate').value),performance.now());$('playback-position').textContent=`${playbackClock.rate}× / ${((playbackFrame?.elapsed??0)/1000).toFixed(2)}秒`;}
 catch(e){$('playback-rate').value=playbackClock.rate;notify(e.message);}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
for(const button of document.querySelectorAll('[data-metric]'))button.onclick=()=>{metric=button.dataset.metric;document.querySelectorAll('[data-metric]').forEach(b=>b.classList.toggle('active',b===button));updateLegend();renderSelected();};
$('pitch').onclick=()=>{map?.togglePitch();$('pitch').textContent=map?.pitch?'3D':'2D';};$('fit').onclick=()=>{setFollow(false);if(map?.google)map.renderGoogle(true);else map?.fit();};$('focus').onclick=()=>{setFollow(true);map?.focus();};
$('follow').onclick=()=>setFollow(!follow);
$('orientation').onchange=()=>{map?.setOrientation($('orientation').value);try{localStorage.setItem('ride-map-orientation',$('orientation').value);}catch{}};
try{const mode=localStorage.getItem('ride-map-orientation');if(mode==='heading'){$('orientation').value=mode;map?.setOrientation(mode);}}catch{}
async function attempt(fn){try{await fn();}catch(e){notify(e.message);status(e.message);}}
$('permission').onclick=()=>attempt(enableSensorPreview);$('calibrate').onclick=()=>attempt(()=>recorder.calibrate());
$('record').onclick=()=>attempt(async()=>{stopPlayback();previousRide=ride;latestFix=null;firstFix=true;setFollow(true);await recorder.start();if(recorder.active){ride=recorder.ride;index=0;setTelemetryMode('sensor');render();}});
$('stop').onclick=()=>recorder.stop();
$('pause-recording').onclick=()=>attempt(async()=>{$('pause-recording').disabled=true;try{if(recorder.paused)await recorder.resume();else {recorder.pause();if(recorder.ride.samples.length)await queueSave(recorder.ride,true);}setRecording(recorder.active);}finally{$('pause-recording').disabled=false;}});
$('save').onclick=()=>queueSave(ride);
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(ride)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ride-'+ride.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
function openRide(value){stopPlayback();ride=value;index=0;setTelemetryMode('ride');render();map?.update(ride.samples,metric,index,true);followPosition();}
$('import').onchange=e=>attempt(async()=>{const file=e.target.files[0];if(!file)return;if(file.size>100*1024*1024)throw Error('ファイルは100 MB以下にしてください');const value=validateRide(JSON.parse(await file.text()));await saveRide(value);openRide(value);notify('走行JSONを読み込み・保存しました');e.target.value='';});
async function showLibrary(){
 const container=$('ride-list');container.replaceChildren();
 const rides=(await listRides()).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));
 if(!rides.length){const p=document.createElement('p');p.textContent='保存された走行はありません。';container.append(p);}
 for(const value of rides){
  const row=document.createElement('div');row.className='library-row';const button=document.createElement('button');button.className='ride-button';
  const title=document.createElement('b');title.textContent=value.name;const meta=document.createElement('small');meta.textContent=`${(distance(value.samples)/1000).toFixed(2)} km / ${value.samples.length.toLocaleString()} 点`;
  button.append(title,meta);button.onclick=()=>{openRide(value);$('library-dialog').close();};
  const del=document.createElement('button');del.className='text-button delete';del.textContent='削除';del.onclick=()=>attempt(async()=>{if(confirm('この走行を端末から削除しますか？')){await deleteRide(value.id);await showLibrary();}});row.append(button,del);container.append(row);
 }
 if(!$('library-dialog').open)$('library-dialog').showModal();
}
$('library').onclick=()=>attempt(showLibrary);$('demo').onclick=()=>{openRide(demoRide());$('library-dialog').close();};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
$('settings').onclick=()=>{fillRanges();$('range-status').textContent='';$('settings-dialog').showModal();try{$('google-key').value=localStorage.getItem('google-maps-key')||'';}catch{}};
function fillRanges(){for(const key of Object.keys(DEFAULT_RANGES))for(const bound of ['min','max'])$(`${key}-${bound}`).value=ranges[key][bound];}
$('range-form').onsubmit=e=>{
 e.preventDefault();
 try{
  const next={};for(const key of Object.keys(DEFAULT_RANGES))next[key]={min:$(`${key}-min`).value===''?NaN:Number($(`${key}-min`).value),max:$(`${key}-max`).value===''?NaN:Number($(`${key}-max`).value)};
  ranges=validateRanges(next);map?.setRanges(ranges);updateLegend();
  try{localStorage.setItem('ride-color-ranges',JSON.stringify(ranges));$('range-status').textContent='保存して地図へ反映しました。';}catch{$('range-status').textContent='反映しましたが端末への保存に失敗しました。';}
 }catch(e){$('range-status').textContent=e.message;}
};
$('reset-ranges').onclick=()=>{for(const key of Object.keys(DEFAULT_RANGES))for(const bound of ['min','max'])$(`${key}-${bound}`).value=DEFAULT_RANGES[key][bound];$('range-form').requestSubmit();};
window.gm_authFailure=()=>{$('google-error').textContent='Google Mapsの認証に失敗しました。API有効化・課金・キーのURL制限を確認してください。';notify('Google Maps認証失敗。地図設定から標準地図へ戻せます。');};
$('google').onclick=async()=>{try{$('google-error').textContent='読み込み中…';const key=$('google-key').value.trim();await map.useGoogle(key);try{localStorage.setItem('google-maps-key',key);}catch{}$('google-error').textContent='Google Mapsに切り替えました。';$('map-provider').textContent='GOOGLE MAPS';followPosition();}catch(e){$('google-error').textContent=e.message;}};
$('openmap').onclick=()=>{map?.useOpenMap();followPosition();$('map-provider').textContent='OPENSTREETMAP';$('settings-dialog').close();};
window.addEventListener('pagehide',()=>{if(recorder.active && !recorder.paused)recorder.stop('ページ終了のため停止しました');});
window.addEventListener('beforeunload',e=>{if(recorder.active){e.preventDefault();e.returnValue='';}});
render();map?.update(ride.samples,metric,index,true);followPosition();
