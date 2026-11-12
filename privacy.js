'use strict';
// No data payloads, persistent identifiers or storage. Timers are best-effort in a browser.
class EphemeralSession {
 constructor({erase, wall=()=>Date.now(), mono=()=>performance.now(),
              schedule=(fn,ms)=>setTimeout(fn,ms), cancel=id=>clearTimeout(id)}) {
  this.erase=erase;this.wall=wall;this.mono=mono;this.schedule=schedule;this.cancel=cancel;
  this.timeout=300000;this.timer=null;this.touch();
 }
 touch(){this.lastWall=this.wall();this.lastMono=this.mono();this.arm()}
 elapsed(){return Math.max(this.wall()-this.lastWall,this.mono()-this.lastMono)}
 arm(){
  if(this.timer!==null)this.cancel(this.timer);
  this.timer=this.schedule(()=>{this.timer=null;if(!this.check())this.arm()},Math.max(1,this.timeout-this.elapsed()));
 }
 check(){if(this.elapsed()>=this.timeout){this.end('idle');return true}return false}
 activity(){this.check();this.touch()}
 end(reason){
  if(this.timer!==null)this.cancel(this.timer);this.timer=null;
  this.erase(reason);this.lastWall=this.wall();this.lastMono=this.mono();
 }
}
if(typeof module!=='undefined')module.exports={EphemeralSession};
