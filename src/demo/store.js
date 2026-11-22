import {PGliteWorker} from '@electric-sql/pglite/worker';
const prefix='folio.v1.';
const customer='11111111-1111-4111-8111-111111111111',staff='22222222-2222-4222-8222-222222222222';
const ls=localStorage;
const read=k=>JSON.parse(ls.getItem(prefix+k)??'null');
const save=(k,v)=>ls.setItem(prefix+k,JSON.stringify(v));
export const identity=()=>read('identity')??'visitor';
function owner(){return identity()==='staff'?staff:customer;}
let ready;
function database(){return ready??=PGliteWorker.create(new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),{dataDir:'idb://folio-shop-v1'});}
async function as(role,sql,args=[]){
 const db=await database();
 return db.transaction(async tx=>{
  await tx.exec('set local role '+role);
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[identity()==='visitor'?'':owner()]);
  return (await tx.query(sql,args)).rows;
 });
}
const account=(sql,args)=>as(identity()==='visitor'?'anon':'authenticated',sql,args);
const one=async (sql,args)=>(await account(sql,args))[0];
const trusted=(sql,args)=>as('service_role',sql,args);
const lock=fn=>navigator.locks.request('folio-session',fn);
function guest(){return read('guest')??{token:crypto.randomUUID(),changes:{}};}
async function enter(mode){
 if(!['guest','customer','staff'].includes(mode))throw Error('Unknown demo profile');
 const id=mode==='staff'?staff:customer,db=await database();
 await db.transaction(async tx=>{
  await tx.query('insert into auth.users(id) values($1) on conflict do nothing',[id]);
  if(mode==='staff')await tx.query('insert into folio.staff values($1) on conflict do nothing',[id]);
  const pending=guest();
  if(mode!=='staff'&&Object.keys(pending.changes).length){
   await tx.exec('set local role authenticated');
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
   await tx.query('select folio.change_cart($1,$2::jsonb)',[pending.token,JSON.stringify(pending.changes)]);
  }
 });
 if(mode!=='staff')ls.removeItem(prefix+'guest');
 save('identity',mode);
}
export const signIn=mode=>lock(()=>enter(mode));
export const signOut=()=>lock(()=>save('identity','visitor'));
export const catalog=()=>account('select *,folio.unit_price(price,discount) as unit from folio.catalog order by product,price desc');
export const reviews=sku=>account('select id,body,rating from folio.reviews where sku=$1 and published order by id desc limit 30',[sku]);
export const review=(sku,rating,body)=>account('insert into folio.reviews(owner,sku,rating,body) values(auth.uid(),$1,$2,$3)',[sku,rating,body]);
export async function basket(){
 if(identity()!=='visitor')return (await one('select folio.my_basket() as lines')).lines;
 const {changes}=guest();return (await catalog()).filter(p=>changes[p.sku]).map(({sku,title,variant,unit,available})=>({sku,title,variant,unit,available,qty:changes[sku]})).sort((a,b)=>a.sku.localeCompare(b.sku));
}
export const change=(sku,delta)=>lock(async()=>{
 if(!Number.isInteger(delta))throw Error('Use whole quantities.');
 if(identity()!=='visitor')return account('select folio.change_cart($1,$2::jsonb)',[crypto.randomUUID(),JSON.stringify({[sku]:delta})]);
 const bag=guest(),next=(bag.changes[sku]??0)+delta;
 if(next<0||next>20)throw Error('Choose up to 20 per item.');
 if(next)bag.changes[sku]=next;else delete bag.changes[sku];
 bag.token=crypto.randomUUID();save('guest',bag);
});
export const place=(expected,channel)=>lock(async()=>{
 if(identity()==='visitor')await enter('guest');
 const key='attempt-'+owner();
 const saved=read(key)??{token:crypto.randomUUID(),expected,channel};
 save(key,saved);
 try{
  const [row]=await trusted('select folio.checkout($1,$2,$3::jsonb,$4,$5) as id',[owner(),saved.token,JSON.stringify(saved.expected),'Sample studio, Fictional Lane',saved.channel]);
  ls.removeItem(prefix+key);return row.id;
 }catch(error){if(error.message.includes('Basket changed')||error.message.includes('unavailable'))ls.removeItem(prefix+key);throw error;}
});
export const pendingAttempt=()=>read('attempt-'+owner());
export const orders=(page=0)=>account('select id,reference,payment,phase,fulfilment,amount,created_at from folio.orders where owner=auth.uid() order by created_at desc,id limit 20 offset $1',[page*20]);
export const order=id=>one('select id,owner,reference,method,lines,subtotal,shipping_fee,tax,amount,destination,payment,phase,fulfilment,created_at from folio.orders where id=$1 and owner=auth.uid()',[id]);
export async function simulate(id,outcome){
 if(!['captured','declined','cancelled','pending'].includes(outcome))throw Error('Unknown scenario');
 const o=await order(id);
 if(!o||o.method!=='online')throw Error('Order unavailable');
 if(outcome!=='pending')await trusted('select folio.evidence($1,$2,$3,$4,$5)',[o.reference,o.amount,'INR','fixture-'+o.reference,outcome]);
}
export const submit=(kind,email,body,consent)=>trusted('select folio.submit_message($1,$2,$3,$4,$5)',[kind,email,body,consent,'browser-demo-subject']);
export const profile=()=>one('select label from folio.profiles where owner=auth.uid()');
export const rename=label=>account('update folio.profiles set label=$1 where owner=auth.uid()',[label]);
export async function adminList(section,page){
 if(identity()!=='staff')throw Error('Staff profile required');
 const queries={
  orders:'select id,reference,payment,phase,fulfilment,method,archived,lines from folio.orders order by created_at desc,id',
  exceptions:"select reference,payment,checks,next_check from folio.orders where phase<>'resolved' and method='online' order by created_at,id",
  catalog:'select * from folio.catalog order by sku',
  reviews:'select id,sku,rating,body,published from folio.reviews order by id desc',
  contact:"select id,email,message,created_at from folio.inbox where kind='contact' order by id desc",
  newsletter:"select id,email,created_at from folio.inbox where kind='newsletter' order by id desc",
  events:'select order_id,kind,note,recorded_at from folio.events order by id desc'
 };
 if(!Object.hasOwn(queries,section))throw Error('Unknown view');
 return account(queries[section]+' limit 20 offset $1',[page*20]);
}
export const staffAction=(id,action,reason)=>account('select folio.staff_action($1,$2,$3)',[id,action,reason]);
export async function editSku(sku,rev,price,discount,available){
 const rows=await account('update folio.catalog set price=$3,discount=$4,available=$5 where sku=$1 and revision=$2 returning sku',[sku,rev,price,discount,available]);
 if(!rows.length)throw Error('Catalog changed. Refresh before editing.');
}
export const createSku=p=>account('insert into folio.catalog(sku,product,title,variant,price) values($1,$2,$3,$4,$5)',p);
export const moderate=id=>account('update folio.reviews set published=true where id=$1',[id]);
export const removeMessage=id=>account('delete from folio.inbox where id=$1',[id]);
