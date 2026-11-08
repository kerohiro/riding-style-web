import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerURL from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerURL);
import {color,destination,magnitude,DEFAULT_RANGES} from './core.js';
import {PositionTween,resolveHeading,separation} from './motion.js';
const collection=features=>({type:'FeatureCollection',features});
const feature=(geometry,properties={})=>({type:'Feature',geometry,properties});
export class RideMap {
  constructor(element,onSelect,onError) {
    this.element=element;this.onSelect=onSelect;this.onError=onError;this.pitch=55;this.metric='speed';this.ranges=DEFAULT_RANGES;this.tween=new PositionTween();this.orientation='north';this.follow=false;this.heading=0;this.duration=200;
    this.map=new maplibregl.Map({container:element,center:[138.994,35.211],zoom:12,pitch:55,style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}},layers:[{id:'base',type:'raster',source:'osm',paint:{'raster-saturation':-0.65,'raster-brightness-max':0.72}}]}});
    this.map.addControl(new maplibregl.NavigationControl(),'top-right');
    this.marker=new maplibregl.Marker({color:'#54efbd'}).setLngLat([138.994,35.211]).addTo(this.map);
    this.map.on('load',()=>{
      for(const id of ['route','vectors','lean'])this.map.addSource(id,{type:'geojson',data:collection([])});
      this.map.addLayer({id:'route-shadow',type:'line',source:'route',paint:{'line-color':'#101825','line-width':10}});
      this.map.addLayer({id:'route',type:'line',source:'route',paint:{'line-color':['get','color'],'line-width':6}});
      this.map.addLayer({id:'vectors',type:'line',source:'vectors',paint:{'line-color':'#ffb567','line-width':3}});
      this.map.addLayer({id:'lean',type:'fill-extrusion',source:'lean',paint:{'fill-extrusion-color':['get','color'],'fill-extrusion-height':['get','height'],'fill-extrusion-opacity':0.65}});
      this.map.on('click','route',e=>{const i=e.features?.[0]?.properties?.index;if(i!==undefined)this.onSelect(Number(i));});
      this.map.on('mouseenter','route',()=>{this.map.getCanvas().style.cursor='pointer';});
      this.map.on('mouseleave','route',()=>{this.map.getCanvas().style.cursor='';});
      this.loaded=true;this.render();this.applyPosition(this.tween.at(performance.now()));
    });
    this.map.on('error',e=>{console.warn(e.error);this.onError('地図を取得できない場合は通信環境を確認してください。データの表示・保存は利用できます。');});
  }
  update(samples,metric,selected,fit=false) {
    Object.assign(this,{samples,metric,selected});
    if(this.google)this.renderGoogle(fit);else {this.render();if(fit)this.fit();}
    if(!this.recording && !this.playback && samples[selected])this.moveLocation(samples[selected]);
  }
  setRanges(ranges) { this.ranges=ranges; if(this.google)this.renderGoogle(false);else this.render(); }
  setTracking({enabled,recording,duration,playback=false}) {this.follow=enabled;this.recording=recording;this.duration=duration;this.playback=playback;}
  setOrientation(mode) {
    this.orientation=mode==='heading'?'heading':'north';
    const position=this.tween.target;
    if(position)this.animatePosition({...position,bearing:this.orientation==='heading'?this.heading:0},250);
  }
  showPlaybackFrame(sample){
    cancelAnimationFrame(this.animation);
    const direction=resolveHeading(sample,this.heading,this.headingLocation);
    this.heading=direction.heading;this.headingLocation=direction.anchor;
    const position={latitude:sample.latitude,longitude:sample.longitude,bearing:this.orientation==='heading'?this.heading:0};
    this.tween=new PositionTween();this.tween.set(position,performance.now(),0);this.applyPosition(position);
  }
  centerLocation(fix,initial=false) {
    if(this.playback){this.showPlaybackFrame(fix.coords);return;}
    if(initial){if(this.google)this.google.setZoom(15);else this.map.jumpTo({zoom:15});}
    this.moveLocation(fix.coords,initial);
  }
  moveLocation(coords,initial=false) {
    const previous=this.lastLocation;
    const direction=resolveHeading(coords,this.heading,this.headingLocation);
    this.heading=direction.heading;this.headingLocation=direction.anchor;
    const target={latitude:coords.latitude,longitude:coords.longitude,bearing:this.orientation==='heading'?this.heading:0};
    const snap=initial || (previous && separation(previous,coords)>2000);
    this.lastLocation={latitude:coords.latitude,longitude:coords.longitude};
    this.animatePosition(target,snap?0:this.duration);
  }
  animatePosition(target,duration) {
    const now=performance.now();
    if(this.tween.set(target,now,duration)){
      cancelAnimationFrame(this.animation);
      const frame=time=>{this.applyPosition(this.tween.at(time));if(this.tween.running(time))this.animation=requestAnimationFrame(frame);};
      if(duration)this.animation=requestAnimationFrame(frame);else frame(now);
    }else this.applyPosition(this.tween.at(now));
  }
  applyPosition(position) {
    if(!position)return;
    const {latitude,longitude,bearing}=position;
    if(this.google){
      this.googleMarker?.setPosition({lat:latitude,lng:longitude});
      if(this.follow)this.google.setCenter({lat:latitude,lng:longitude});
      this.google.setHeading(bearing);
    }else{
      this.marker.setLngLat([longitude,latitude]);
      this.map.jumpTo({...(this.follow?{center:[longitude,latitude]}:{}),bearing});
    }
  }
  fit() {
    if(!this.samples?.length)return;
    const bounds=new maplibregl.LngLatBounds();this.samples.forEach(s=>bounds.extend([s.longitude,s.latitude]));
    this.map.fitBounds(bounds,{padding:65,maxZoom:16,duration:0,pitch:this.pitch});
  }
  focus() {
    const s=this.samples?.[this.selected];if(!s)return;
    if(this.google){this.google.panTo({lat:s.latitude,lng:s.longitude});return;}
    this.map.flyTo({center:[s.longitude,s.latitude],zoom:14,pitch:this.pitch});
  }
  togglePitch(){this.pitch=this.pitch?0:55;if(this.google)this.google.setTilt(this.pitch?45:0);else this.map.easeTo({pitch:this.pitch});}
  render() {
    if(!this.loaded || !this.samples?.length)return;
    const routeDirty=this.routeSamples!==this.samples || this.routeLength!==this.samples.length || this.routeMetric!==this.metric || this.routeRanges!==this.ranges;
    const route=[],vectors=[],lean=[];const stride=Math.max(1,Math.ceil(this.samples.length/1200));
    if(routeDirty)for(let i=0;i<this.samples.length-1;i+=stride){
      const a=this.samples[i],b=this.samples[Math.min(i+stride,this.samples.length-1)];
      if((a.segment??0)!==(b.segment??0) || Date.parse(b.time)-Date.parse(a.time)>stride*3000)continue;
      route.push(feature({type:'LineString',coordinates:[[a.longitude,a.latitude],[b.longitude,b.latitude]]},{color:color(b,this.metric,this.ranges),index:i}));
    }
    const selected=this.samples[this.selected];
    const pointStride=Math.max(40,Math.ceil(this.samples.length/60));
    const points=new Set([this.selected,...Array.from({length:Math.ceil(this.samples.length/pointStride)},(_,i)=>i*pointStride)]);
    for(const i of points){
      const s=this.samples[i];if(!s)continue;
      if(s.acceleration && s.course!==null && s.course>=0){
        const horizontal=Math.hypot(s.acceleration.x,s.acceleration.y);
        if(horizontal>0.1){
          const heading=s.course+Math.atan2(s.acceleration.x,s.acceleration.y)*180/Math.PI;
          const end=destination(s.latitude,s.longitude,heading,Math.min(140,horizontal*22));
          const wing1=destination(end[1],end[0],heading+150,12),wing2=destination(end[1],end[0],heading-150,12);
          vectors.push(feature({type:'LineString',coordinates:[[s.longitude,s.latitude],end,wing1,end,wing2]}));
        }
      }
      if(s.lean!==null){
        const p=[s.longitude,s.latitude],n=destination(s.latitude,s.longitude,0,9),e=destination(s.latitude,s.longitude,90,9);
        lean.push(feature({type:'Polygon',coordinates:[[[p[0]-Math.abs(e[0]-p[0]),p[1]-Math.abs(n[1]-p[1])],[e[0],p[1]-Math.abs(n[1]-p[1])],[e[0],n[1]],[p[0]-Math.abs(e[0]-p[0]),n[1]],[p[0]-Math.abs(e[0]-p[0]),p[1]-Math.abs(n[1]-p[1])]]]}, {height:Math.abs(s.lean)*2,color:color(s,'lean',this.ranges)}));
      }
    }
    if(routeDirty){this.map.getSource('route').setData(collection(route));this.routeSamples=this.samples;this.routeLength=this.samples.length;this.routeMetric=this.metric;this.routeRanges=this.ranges;}this.map.getSource('vectors').setData(collection(vectors));this.map.getSource('lean').setData(collection(lean));

  }
  async useGoogle(key) {
    if(this.google)return;
    if(!key.trim())throw Error('Google Maps JavaScript APIキーを入力してください');
    if(!window.google?.maps){
      await new Promise((resolve,reject)=>{
        window.rideAtlasGoogleReady=()=>{delete window.rideAtlasGoogleReady;resolve();};
        const script=document.createElement('script');script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key.trim())}&callback=rideAtlasGoogleReady&loading=async&v=weekly`;
        script.onerror=()=>{delete window.rideAtlasGoogleReady;script.remove();reject(Error('Google Mapsを読み込めませんでした'));};document.head.append(script);
      });
    }
    this.googleContainer=document.createElement('div');this.googleContainer.className='google-map';this.element.append(this.googleContainer);
    this.google=new google.maps.Map(this.googleContainer,{center:{lat:35.211,lng:138.994},zoom:12,mapTypeId:'hybrid',renderingType:google.maps.RenderingType.VECTOR,tilt:45,streetViewControl:false,fullscreenControl:false});
    this.googleLines=[];this.googleRouteSamples=null;this.renderGoogle(true);this.applyPosition(this.tween.at(performance.now()));
  }
  useOpenMap(){if(this.google){this.googleLines.forEach(l=>l.setMap(null));this.googleVectors?.forEach(l=>l.setMap(null));this.googleMarker?.setMap(null);this.googleContainer.remove();this.google=null;this.googleMarker=null;}this.map.resize();this.render();this.fit();this.applyPosition(this.tween.at(performance.now()));}
  renderGoogle(fit) {
    const dirty=this.googleRouteSamples!==this.samples || this.googleRouteLength!==this.samples?.length || this.googleRouteMetric!==this.metric || this.googleRouteRanges!==this.ranges;
    if(dirty){this.googleLines.forEach(l=>l.setMap(null));this.googleLines=[];}
    this.googleVectors?.forEach(l=>l.setMap(null));this.googleVectors=[];
    const samples=this.samples||[],stride=Math.max(1,Math.ceil(samples.length/800));
    if(dirty)for(let i=0;i<samples.length-1;i+=stride){
      const a=samples[i],b=samples[Math.min(i+stride,samples.length-1)];
      if((a.segment??0)!==(b.segment??0) || Date.parse(b.time)-Date.parse(a.time)>stride*3000)continue;
      const line=new google.maps.Polyline({map:this.google,path:[{lat:a.latitude,lng:a.longitude},{lat:b.latitude,lng:b.longitude}],strokeColor:color(b,this.metric,this.ranges),strokeWeight:6});
      line.addListener('click',()=>this.onSelect(i));this.googleLines.push(line);
    }
    if(dirty){this.googleRouteSamples=this.samples;this.googleRouteLength=samples.length;this.googleRouteMetric=this.metric;this.googleRouteRanges=this.ranges;}
    const s=samples[this.selected];
    if(s){
      const position={lat:s.latitude,lng:s.longitude};
      if(!this.googleMarker)this.googleMarker=new google.maps.Marker({map:this.google,position});
      if(s.acceleration && s.course!==null && s.course>=0 && magnitude(s)>0.1){
        const end=destination(s.latitude,s.longitude,s.course+Math.atan2(s.acceleration.x,s.acceleration.y)*180/Math.PI,Math.hypot(s.acceleration.x,s.acceleration.y)*22);
        this.googleVectors.push(new google.maps.Polyline({map:this.google,path:[position,{lat:end[1],lng:end[0]}],strokeColor:'#ffb567',strokeWeight:3,icons:[{icon:{path:google.maps.SymbolPath.FORWARD_CLOSED_ARROW},offset:'100%'}]}));
      }
    }
    if(fit && samples.length){const bounds=new google.maps.LatLngBounds();samples.forEach(s=>bounds.extend({lat:s.latitude,lng:s.longitude}));this.google.fitBounds(bounds,50);}
  }
}
