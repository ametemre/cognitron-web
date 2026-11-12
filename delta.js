/* Observable delta bytes only; metadata never substitutes for missing data. */
'use strict';
class DeltaMatrix {
 constructor(){this.records=[];this.queue=[];this.bytes=0;this.received=0;this.enqueued=0;this.spawned=0;this.skipped=0;this.unavailable=0;this.empty=0;this.evicted=0;}
 accept(event){
  const {from,to,kind,seq,payload_size_bytes,available,bytes}=event;
  if(typeof from!=='string'||typeof to!=='string'||typeof kind!=='string'||!Number.isSafeInteger(seq)||!Number.isSafeInteger(payload_size_bytes)||payload_size_bytes<0||typeof available!=='boolean'||!Array.isArray(bytes)||bytes.length!==payload_size_bytes||bytes.some(b=>!Number.isInteger(b)||b<0||b>255)||(!available&&bytes.length))throw Error('Geçersiz delta kaydı.');
  // A hidden payload still has an observable callback occurrence.
  // This envelope represents runtime activity, never private reasoning text.
  const visualBytes=available?bytes:Array.from(new TextEncoder().encode(JSON.stringify({kind:'runtime_callback',source_kind:kind,seq,payload_available:false})));
  const skipped=visualBytes.length>0&&this.bytes+visualBytes.length>4096;
  const record={from,to,kind,seq,payload_size_bytes,available,skipped};
  this.received++;this.records.push(record);if(this.records.length>1024){this.records.shift();this.evicted++;}
  if(!available)this.unavailable++;
  if(!visualBytes.length){this.empty++;return;}
  if(skipped){this.skipped++;return;}
  this.queue.push({...record,bytes:Uint8Array.from(visualBytes),representation:available?'payload':'runtime_occurrence'});this.bytes+=visualBytes.length;this.enqueued++;
 }
 spawn(){
  const packet=this.queue.shift();if(!packet)return null;
  // Birth uses the previous spawned packet, chained across the stream.
  const seed=this.birthSeed??0x811c9dc5;
  packet.birth={u:(seed>>>0)/4294967296,v:((Math.imul(seed^0x9e3779b9,0x85ebca6b)>>>0)/4294967296)};
  let hash=seed;
  for(const byte of packet.bytes)hash=Math.imul(hash^byte,0x01000193)>>>0;
  hash^=hash>>>16;hash=Math.imul(hash,0x85ebca6b);hash^=hash>>>13;hash=Math.imul(hash,0xc2b2ae35);hash^=hash>>>16;
  this.birthSeed=hash>>>0;
  this.bytes-=packet.bytes.length;this.spawned++;return packet;
 }
 reset(){
  for(const packet of this.queue)packet.bytes.fill(0);
  this.queue.length=0;this.records.length=0;delete this.birthSeed;
  for(const key of ['bytes','received','enqueued','spawned','skipped','unavailable','empty','evicted'])this[key]=0;
 }
 snapshot(){return {received:this.received,enqueued:this.enqueued,spawned:this.spawned,queued:this.queue.length,skipped:this.skipped,unavailable:this.unavailable,empty:this.empty,retained:this.records.length,evicted:this.evicted};}
}
if(typeof module!=='undefined')module.exports={DeltaMatrix};
