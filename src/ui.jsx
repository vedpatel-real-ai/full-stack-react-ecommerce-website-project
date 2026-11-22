import React,{useEffect,useState} from 'react';
export const money=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(value)/100);
export function go(path){history.pushState({},'',path);window.dispatchEvent(new Event('popstate'));}
export function useData(fetcher,deps){
 const [state,set]=useState({loading:true});
 useEffect(()=>{let live=true;set({loading:true});Promise.resolve().then(fetcher).then(data=>live&&set({data}),()=>live&&set({error:'This view could not be loaded. Refresh to try again.'}));return()=>{live=false;};},deps);
 return state;
}
export function Result({state,children}){if(state.loading)return <p role="status">Opening the local collection…</p>;if(state.error)return <p role="alert">{state.error}</p>;return children(state.data);}
export function useAction(refresh){
 const [message,set]=useState(''),[busy,wait]=useState(false);
 async function run(fn,success=''){if(busy)return;wait(true);set('');try{await fn();set(success);refresh?.();}catch(e){const known=['Quantity','Basket changed','Attempt conflict','Item unavailable','Transition unavailable','Staff and note','Catalog changed','Choose up to','Please try again','Basket limit'];set(known.some(k=>e.message.startsWith(k))?e.message:'Unable to save. Check the fields and try again.');}finally{wait(false);}}
 return {run,busy,message};
}
export function Feedback({action}){return <p className="feedback" role="status">{action.message}</p>;}
export function Art({product,small=false}){
 const kind=['ledger','index','planner','folder'].includes(product)?product:'ledger';
 return <div className={'art '+kind+(small?' compact':'')} role="img" aria-label={({ledger:'Moss cloth notebook with a grid-paper cover label',index:'A stack of ruled ivory index cards',planner:'Terracotta spiral-bound weekly planner',folder:'Blue-grey archival folder'})[kind]}><div className="shadow"></div><div className="object"><i></i><span>{({ledger:'FIELD NOTES',index:'INDEX',planner:'WEEKLY',folder:'ARCHIVE'})[kind]}</span><b>FOLIO SUPPLY</b></div></div>;
}
export function Lines({lines}){return <ul className="lines">{lines.map(l=><li key={l.sku}><div><strong>{l.title}</strong><small>{l.variant} · {l.sku}</small></div><div>{l.qty} × {money(l.unit)}<small>{money(l.qty*l.unit)}</small></div></li>)}</ul>;}
export function Pager({page,set,count}){return <div className="row"><button disabled={page===0} onClick={()=>set(page-1)}>Previous</button><span>Page {page+1}</span><button disabled={count<20} onClick={()=>set(page+1)}>Next</button></div>;}
