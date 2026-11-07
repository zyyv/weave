// Page history stays in memory and never changes the local service URL.
export class NavigationHistory {
  constructor(limit=100){this.limit=limit;this.entries=[];this.index=-1}
  get canBack(){return this.index>0}
  get canForward(){return this.index>=0&&this.index<this.entries.length-1}
  reset(route){this.entries=[structuredClone(route)];this.index=0}
  replace(route){if(this.index<0)this.reset(route);else this.entries[this.index]=structuredClone(route)}
  push(route){
    const key=r=>JSON.stringify({...r,scroll:0});
    if(this.index>=0&&key(this.entries[this.index])===key(route)){this.replace(route);return}
    this.entries.splice(this.index+1);this.entries.push(structuredClone(route));
    if(this.entries.length>this.limit)this.entries.shift();this.index=this.entries.length-1;
  }
  move(step,current){
    if(step!==-1&&step!==1)return null;
    if(step<0?!this.canBack:!this.canForward)return null;
    this.replace(current);this.index+=step;return structuredClone(this.entries[this.index]);
  }
}
