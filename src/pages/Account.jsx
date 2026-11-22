import React from 'react';
import * as db from '../demo/store.js';
import {Feedback,Result,go,useAction,useData} from '../ui.jsx';
export function Account({refresh,version}){
 const a=useAction(refresh),mode=db.identity();
 const s=useData(()=>mode==='visitor'?null:db.profile(),[mode,version]);
 return <><h1>Your studio profile</h1><p>Choose a synthetic identity for this browser. Your basket follows you into the customer profile.</p><p>Current profile · <strong>{mode}</strong></p><div className="row">{['customer','staff'].map(m=><button disabled={a.busy} key={m} onClick={()=>a.run(async()=>{await db.signIn(m);go(m==='staff'?'/admin':'/profile');})}>Open {m} profile</button>)}{mode!=='visitor'&&<button onClick={()=>a.run(db.signOut,'Signed out.')}>Sign out</button>}</div><Result state={s}>{p=>p&&<form onSubmit={e=>{e.preventDefault();const label=new FormData(e.target).get('label');a.run(()=>db.rename(label),'Profile saved.');}}><label>Demo display name<input required maxLength="80" defaultValue={p.label} name="label"/></label><button>Save profile</button></form>}</Result><Feedback action={a}/></>;
}
export function Contact({refresh}){
 const a=useAction(refresh);
 return <><h1>Contact the studio</h1><p>Use fictional details. Messages and subscriptions stay in this browser.</p>{['contact','newsletter'].map(kind=><form className="panel" key={kind} onSubmit={e=>{e.preventDefault();const f=new FormData(e.target);a.run(()=>db.submit(kind,f.get('email'),f.get('message')??'',f.has('consent')),'Saved to the local studio.');}}><h2>{kind==='contact'?'Send a message':'Studio newsletter'}</h2><label>Sample email<input name="email" type="email" required maxLength="180" placeholder="reader@example.invalid"/></label>{kind==='contact'&&<label>Message<textarea name="message" minLength="3" maxLength="1000" required/></label>}<label><input name="consent" type="checkbox" required/> Store this synthetic submission locally</label><button disabled={a.busy}>{kind==='contact'?'Send message':'Subscribe'}</button></form>)}<Feedback action={a}/></>;
}
