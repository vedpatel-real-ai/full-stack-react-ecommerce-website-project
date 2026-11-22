import {PGlite} from '@electric-sql/pglite';
import {worker} from '@electric-sql/pglite/worker';
import bootstrap from './bootstrap.sql?raw';
import seed from './seed.sql?raw';
const migrations=import.meta.glob('../../supabase/migrations/*.sql',{eager:true,query:'?raw',import:'default'});
worker({async init(options){
 const db=await PGlite.create(options.dataDir);
 await db.exec('create table if not exists public.demo_migrations(name text primary key)');
 for(const [name,sql] of [['00-bootstrap',bootstrap],...Object.entries(migrations).sort(),['seed',seed]]){
  if((await db.query('select 1 from public.demo_migrations where name=$1',[name])).rows.length)continue;
  await db.transaction(async tx=>{
   await tx.exec(sql.replace(/^begin;|^commit;/gmi,''));
   await tx.query('insert into public.demo_migrations values($1)',[name]);
  });
 }
 return db;
}});
