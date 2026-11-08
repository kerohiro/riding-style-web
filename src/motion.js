export const angleDelta=(from,to)=>((to-from+540)%360+360)%360-180;
export function interpolatePosition(from,to,t) {
  return {latitude:from.latitude+(to.latitude-from.latitude)*t,
    longitude:from.longitude+angleDelta(from.longitude,to.longitude)*t,
    bearing:from.bearing+angleDelta(from.bearing,to.bearing)*t};
}
export function courseBetween(from,to) {
  const rad=Math.PI/180,dl=angleDelta(from.longitude,to.longitude)*rad;
  return (Math.atan2(Math.sin(dl)*Math.cos(to.latitude*rad),Math.cos(from.latitude*rad)*Math.sin(to.latitude*rad)-Math.sin(from.latitude*rad)*Math.cos(to.latitude*rad)*Math.cos(dl))/rad+360)%360;
}
export function separation(a,b){return Math.hypot((a.latitude-b.latitude)*111320,angleDelta(a.longitude,b.longitude)*111320*Math.cos(a.latitude*Math.PI/180));}
// Uses the displayed position as the next starting point, even when retargeted mid-frame.
export class PositionTween {
  set(target,now,duration=0){
    if(this.target && ['latitude','longitude','bearing'].every(k=>target[k]===this.target[k]))return false;
    this.from=this.at(now)??target;this.target={...target};this.start=now;this.duration=duration;
    return true;
  }
  at(now){if(!this.target)return null;const t=this.duration?Math.min(1,Math.max(0,(now-this.start)/this.duration)):1;return interpolatePosition(this.from,this.target,t);}
  running(now){return !!this.target && now<this.start+this.duration;}
}
export function resolveHeading(coords,heading,anchor) {
  const point={latitude:coords.latitude,longitude:coords.longitude};
  if(Number.isFinite(coords.speed) && coords.speed<1.5)return {heading,anchor:point};
  const course=coords.course??coords.heading;
  if(Number.isFinite(course) && course>=0 && course<=360)return {heading:course%360,anchor:point};
  if(anchor && separation(anchor,point)>3)return {heading:courseBetween(anchor,point),anchor:point};
  return {heading,anchor:anchor??point};
}
