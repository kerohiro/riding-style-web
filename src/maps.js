import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerURL from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerURL);
import {color,destination,magnitude} from './core.js';
const collection=features=>({type:'FeatureCollection',features});
const feature=(geometry,properties={})=>({type:'Feature',geometry,properties});
export class RideMap {
  constructor(element,onSelect,onError) {
    this.element=element;this.onSelect=onSelect;this.onError=onError;this.pitch=55;this.metric='speed';
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
      this.loaded=true;this.render();
    });
    this.map.on('error',e=>{console.warn(e.error);this.onError('地図を取得できない場合は通信環境を確認してください。データの表示・保存は利用できます。');});
  }
  update(samples,metric,selected,fit=false) {
    Object.assign(this,{samples,metric,selected});
    if(this.google){this.renderGoogle(fit);return;}
    this.render();if(fit)this.fit();
  }
  fit() {
    if(!this.samples?.length)return;
    const bounds=new maplibregl.LngLatBounds();this.samples.forEach(s=>bounds.extend([s.longitude,s.latitude]));
    this.map.fitBounds(bounds,{padding:65,maxZoom:16,duration:500,pitch:this.pitch});
  }
  focus() {
    const s=this.samples?.[this.selected];if(!s)return;
    if(this.google){this.google.panTo({lat:s.latitude,lng:s.longitude});return;}
    this.map.flyTo({center:[s.longitude,s.latitude],zoom:14,pitch:this.pitch});
  }
  togglePitch(){this.pitch=this.pitch?0:55;if(this.google)this.google.setTilt(this.pitch?45:0);else this.map.easeTo({pitch:this.pitch});}
  render() {
    if(!this.loaded || !this.samples?.length)return;
    const route=[],vectors=[],lean=[];const stride=Math.max(1,Math.ceil(this.samples.length/1200));
    for(let i=0;i<this.samples.length-1;i+=stride){
      const a=this.samples[i],b=this.samples[Math.min(i+stride,this.samples.length-1)];
      if(Date.parse(b.time)-Date.parse(a.time)>stride*3000)continue;
      route.push(feature({type:'LineString',coordinates:[[a.longitude,a.latitude],[b.longitude,b.latitude]]},{color:color(b,this.metric),index:i}));
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
        lean.push(feature({type:'Polygon',coordinates:[[[p[0]-Math.abs(e[0]-p[0]),p[1]-Math.abs(n[1]-p[1])],[e[0],p[1]-Math.abs(n[1]-p[1])],[e[0],n[1]],[p[0]-Math.abs(e[0]-p[0]),n[1]],[p[0]-Math.abs(e[0]-p[0]),p[1]-Math.abs(n[1]-p[1])]]]}, {height:Math.abs(s.lean)*2,color:color(s,'lean')}));
      }
    }
    this.map.getSource('route').setData(collection(route));this.map.getSource('vectors').setData(collection(vectors));this.map.getSource('lean').setData(collection(lean));
    if(selected)this.marker.setLngLat([selected.longitude,selected.latitude]);
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
    this.google=new google.maps.Map(this.googleContainer,{center:{lat:35.211,lng:138.994},zoom:12,mapTypeId:'hybrid',tilt:45,streetViewControl:false,fullscreenControl:false});
    this.googleLines=[];this.renderGoogle(true);
  }
  useOpenMap(){if(this.google){this.googleLines.forEach(l=>l.setMap(null));this.googleMarker?.setMap(null);this.googleContainer.remove();this.google=null;this.googleMarker=null;}this.map.resize();this.render();this.fit();}
  renderGoogle(fit) {
    this.googleLines.forEach(l=>l.setMap(null));this.googleLines=[];
    const samples=this.samples||[],stride=Math.max(1,Math.ceil(samples.length/800));
    for(let i=0;i<samples.length-1;i+=stride){
      const a=samples[i],b=samples[Math.min(i+stride,samples.length-1)];
      if(Date.parse(b.time)-Date.parse(a.time)>stride*3000)continue;
      const line=new google.maps.Polyline({map:this.google,path:[{lat:a.latitude,lng:a.longitude},{lat:b.latitude,lng:b.longitude}],strokeColor:color(b,this.metric),strokeWeight:6});
      line.addListener('click',()=>this.onSelect(i));this.googleLines.push(line);
    }
    const s=samples[this.selected];
    if(s){
      const position={lat:s.latitude,lng:s.longitude};
      if(!this.googleMarker)this.googleMarker=new google.maps.Marker({map:this.google,position});else this.googleMarker.setPosition(position);
      if(s.acceleration && s.course!==null && s.course>=0 && magnitude(s)>0.1){
        const end=destination(s.latitude,s.longitude,s.course+Math.atan2(s.acceleration.x,s.acceleration.y)*180/Math.PI,Math.hypot(s.acceleration.x,s.acceleration.y)*22);
        this.googleLines.push(new google.maps.Polyline({map:this.google,path:[position,{lat:end[1],lng:end[0]}],strokeColor:'#ffb567',strokeWeight:3,icons:[{icon:{path:google.maps.SymbolPath.FORWARD_CLOSED_ARROW},offset:'100%'}]}));
      }
    }
    if(fit && samples.length){const bounds=new google.maps.LatLngBounds();samples.forEach(s=>bounds.extend({lat:s.latitude,lng:s.longitude}));this.google.fitBounds(bounds,50);}
  }
}
