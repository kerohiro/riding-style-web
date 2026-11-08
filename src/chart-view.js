const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export class ChartView {
 constructor(){this.reset();}
 reset(){this.x=0;this.width=1;this.y=0;this.height=1;}
 snapshot(){return {x:this.x,width:this.width,y:this.y,height:this.height};}
 set(view,minWidth=0.001){
  this.width=clamp(view.width,minWidth,1);this.height=clamp(view.height,0.01,1);
  this.x=clamp(view.x,0,1-this.width);this.y=clamp(view.y,0,1-this.height);
 }
 zoom(factor,anchorX=0.5,anchorY=0.5,axis='x',minWidth=0.001){
  const width=axis==='y'?this.width:clamp(this.width/factor,minWidth,1);
  const height=axis==='x'?this.height:clamp(this.height/factor,0.01,1);
  this.set({x:this.x+anchorX*(this.width-width),y:this.y+anchorY*(this.height-height),width,height},minWidth);
 }
 pan(dx,dy=0){this.set({x:this.x+dx*this.width,y:this.y+dy*this.height,width:this.width,height:this.height},this.width);}
 fraction(position){return (position-this.x)/this.width;}
 position(fraction){return this.x+clamp(fraction,0,1)*this.width;}
 reveal(position){
  if(position>=this.x && position<=this.x+this.width)return false;
  this.x=clamp(position-this.width*0.5,0,1-this.width);return true;
 }
}
