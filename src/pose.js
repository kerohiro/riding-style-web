import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
export class Pose {
 constructor(element) {
  this.scene=new THREE.Scene();
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));element.append(this.renderer.domElement);
  this.camera=new THREE.PerspectiveCamera(38,1,0.1,100);this.camera.position.set(3,2.3,4.5);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0.8,0);this.controls.enableZoom=false;this.controls.update();
  this.scene.add(new THREE.HemisphereLight(0xcceeff,0x18232c,3));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,5,4);this.scene.add(light);
  const grid=new THREE.GridHelper(6,12,0x3a5261,0x1c2c39);this.scene.add(grid);
  this.bike=new THREE.Group();this.scene.add(this.bike);
  const dark=new THREE.MeshStandardMaterial({color:0x202b35,roughness:0.5}),mint=new THREE.MeshStandardMaterial({color:0x54efbd,metalness:0.4,roughness:0.3});
  for(const z of [-0.65,0.65]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(0.31,0.075,12,32),dark);wheel.rotation.y=Math.PI/2;wheel.position.set(0,0.36,z);this.bike.add(wheel);}
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.45,1.05),mint);body.position.y=0.85;this.bike.add(body);
  const rider=new THREE.Mesh(new THREE.CapsuleGeometry(0.16,0.34,4,12),dark);rider.position.set(0,1.25,0.1);rider.rotation.x=-0.3;this.bike.add(rider);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.17,20,16),new THREE.MeshStandardMaterial({color:0xe6eef3}));head.position.set(0,1.65,-0.02);this.bike.add(head);
  const handle=new THREE.Mesh(new THREE.BoxGeometry(0.65,0.04,0.05),mint);handle.position.set(0,1.1,-0.5);this.bike.add(handle);
  this.arrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(0,1,0),1,0xffb567,0.2,0.12);this.bike.add(this.arrow);
  const front=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0.02,-1),0.7,0x507183,0.15,0.1);this.scene.add(front);
  new ResizeObserver(()=>{const w=element.clientWidth,h=element.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.render();}).observe(element);
  this.controls.addEventListener('change',()=>this.render());this.render();
 }
 update(s){
  this.bike.rotation.z=-(s?.lean??0)*Math.PI/180;
  const a=s?.acceleration;this.arrow.visible=!!a&&Math.hypot(a.x,a.y,a.z)>0.05;
  if(this.arrow.visible){this.arrow.setDirection(new THREE.Vector3(a.x,a.z,-a.y).normalize());this.arrow.setLength(Math.min(2,Math.hypot(a.x,a.y,a.z)/3),0.2,0.12);}this.render();
 }
 render(){this.renderer.render(this.scene,this.camera);}
}
