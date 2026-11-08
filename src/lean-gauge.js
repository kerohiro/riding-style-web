// Code-native rear-view motorcycle, drawn once; only the pose is changed per frame.
export function leanGaugeMarkup(){
 const polar=(degrees,r)=>{const rad=degrees*Math.PI/180;return [50+Math.sin(rad)*r,63-Math.cos(rad)*r];};
 const ticks=Array.from({length:13},(_,i)=>{
  const degrees=(i-6)*10,a=polar(degrees,47),b=polar(degrees,degrees%20===0?42:44);
  return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="lean-tick"/>`;
 }).join('');
 return `<svg class="lean-gauge" viewBox="0 0 100 72" aria-hidden="true" focusable="false">
 <path d="M9.3 39.5 A47 47 0 0 1 90.7 39.5" class="lean-arc"/>
 ${ticks}<g class="lean-scale"><text x="50" y="11" text-anchor="middle">0</text><text x="9" y="45" text-anchor="middle">60</text><text x="91" y="45" text-anchor="middle">60</text></g>
 <path d="M10 63H90 M50 15V67" class="lean-reference"/>
 <g id="lean-bike" transform="rotate(0 50 63)">
 <path d="M50 63V15" class="lean-indicator"/>
 <circle cx="50" cy="24" r="5.5" fill="#edf8ff"/>
 <path d="M42 34Q42 30 47 30H53Q58 30 58 34L56 43H44Z" fill="#edf8ff"/>
 <path d="M43 33L38 39M57 33L62 39M38 38H62" fill="none" stroke="#edf8ff" stroke-width="2.5" stroke-linecap="round"/>
 <path d="M44 40Q50 37 56 40L59 47L54 52H46L41 47Z" fill="#54efbd" stroke="#edf8ff" stroke-width="1"/>
 <rect x="46" y="47" width="8" height="16" rx="4" fill="#12212d" stroke="#edf8ff" stroke-width="2"/>
 <path d="M49 51V59" stroke="#7895a6" stroke-width="1"/>
 <rect x="47" y="42" width="6" height="2.5" rx="1" fill="#ff8e91"/>
 </g></svg>`;
}
export function renderLeanCard(angle){
 const valid=Number.isFinite(angle),card=document.getElementById('lean-card');
 document.getElementById('lean').textContent=valid?Math.abs(angle).toFixed(1):'—';
 document.getElementById('lean-label').textContent=valid?(Math.abs(angle)<0.05?'直立・推定':(angle>0?'右':'左')+'リーン・推定'):'リーン角・推定';
 document.getElementById('lean-bike').setAttribute('transform',`rotate(${valid?angle:0} 50 63)`);
 card.dataset.valid=String(valid);
 card.setAttribute('aria-label',valid?`推定リーン角 ${Math.abs(angle).toFixed(1)}度、${Math.abs(angle)<0.05?'直立':angle>0?'右傾き':'左傾き'}`:'推定リーン角 データなし');
}
