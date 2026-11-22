-- Fresh namespace only. Collision is a preflight failure.
begin;
create schema folio;
revoke all on schema folio from public;
grant usage on schema folio to anon,authenticated,service_role;
set local search_path=folio,pg_catalog;
alter default privileges in schema folio revoke execute on functions from public;

create table profiles(owner uuid primary key references auth.users(id), label text not null default 'Customer' check(length(label) between 1 and 80));
create table staff(owner uuid primary key references auth.users(id));
create function is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from folio.staff where owner=auth.uid())
$$;
create function provision() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into folio.profiles(owner) values(new.id); return new; end $$;
create trigger folio_profile after insert on auth.users for each row execute function provision();
insert into profiles(owner) select id from auth.users;

create table catalog(
 sku text primary key check(sku ~ '^[a-z0-9-]{1,40}$'),
 product text not null check(product ~ '^[a-z0-9-]{1,40}$'),
 title text not null check(length(title) between 1 and 100),
 variant text not null check(length(variant) between 1 and 50),
 price integer not null check(price between 1 and 10000000),
 discount integer not null default 0 check(discount between 0 and 9999),
 available boolean not null default true,
 revision integer not null default 1,
 unique(product,variant)
);
create function unit_price(price integer,discount integer) returns integer language sql immutable strict as $$
 select greatest(1,((price::bigint*(10000-discount)+5000)/10000)::integer)
$$;
create table carts(owner uuid references profiles, sku text references catalog, qty integer not null check(qty between 1 and 20), primary key(owner,sku));
create table mutations(owner uuid references profiles, token uuid, payload jsonb not null,primary key(owner,token));
create sequence gateway_refs;
create table orders(
 id uuid primary key default gen_random_uuid(), owner uuid not null references profiles, attempt uuid not null,
 reference text not null unique default ('F'||nextval('folio.gateway_refs')) check(reference ~ '^F[0-9]{1,19}$'),
 method text not null check(method in ('online','cod')), lines jsonb not null check(jsonb_typeof(lines)='array' and jsonb_array_length(lines)>0),
 subtotal bigint not null check(subtotal>0), shipping_fee integer not null check(shipping_fee>=0), tax bigint not null check(tax>=0),
 amount bigint generated always as (subtotal+shipping_fee+tax) stored, destination text not null check(length(destination) between 3 and 240),
 quote text not null, payment text not null default 'pending' check(payment in ('pending','declined','cancelled','captured','refunded','chargeback')),
 phase text not null default 'awaiting' check(phase in ('awaiting','reconciling','resolved')),
 fulfilment text not null default 'new' check(fulfilment in ('new','packing','shipped','delivered','returned','cancelled')),
 archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 next_check timestamptz default now()+interval '15 minutes', checks integer not null default 0,
 unique(owner,attempt)
);
create index order_history on orders(owner,created_at desc);
create index exceptions on orders(next_check) where phase<>'resolved';
create table tracking(ref text primary key check(length(ref) between 1 and 100), order_id uuid not null references orders);
create table events(id bigint generated always as identity primary key,order_id uuid not null references orders,kind text not null,actor text not null,note text not null default '',recorded_at timestamptz not null default now(),dedupe text,unique(order_id,dedupe));
create table reviews(id bigint generated always as identity primary key, owner uuid not null references profiles,sku text not null references catalog, rating integer not null check(rating between 1 and 5),body text not null check(length(trim(body)) between 3 and 500),published boolean not null default false,unique(owner,sku));
create table inbox(id bigint generated always as identity primary key,kind text not null check(kind in ('contact','newsletter')),email text not null check(length(email)<=180 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),message text not null check(length(message)<=1000),consent boolean not null check(consent),created_at timestamptz not null default now());
create unique index subscriber_once on inbox(lower(email)) where kind='newsletter';
create table limits(bucket text primary key,started timestamptz not null,n integer not null);
create function throttle(k text,maximum integer) returns void language plpgsql set search_path=folio,pg_catalog as $$
declare used integer;
begin
 insert into limits values(k,now(),1) on conflict(bucket) do update set
 n=case when limits.started < now()-interval '10 minutes' then 1 else limits.n+1 end,
 started=case when limits.started < now()-interval '10 minutes' then now() else limits.started end returning n into used;
 if used>maximum then raise exception 'Please try again later'; end if;
end $$;

create function change_cart(token uuid, changes jsonb) returns void language plpgsql security definer set search_path=folio,pg_catalog as $$
declare who uuid:=auth.uid(); item record; old_payload jsonb; new_qty int;
begin
 if who is null or token is null or jsonb_typeof(changes) is distinct from 'object' or changes='{}' then raise exception 'Invalid cart'; end if;
 perform 1 from profiles where owner=who for update;
 select m.payload into old_payload from mutations m where m.owner=who and m.token=change_cart.token;
 if found then if old_payload<>changes then raise exception 'Mutation conflict'; end if; return; end if;
 perform throttle('cart-'||who,150);
 for item in select key,value from jsonb_each_text(changes) order by key loop
  if item.value is null or item.value !~ '^-?[0-9]{1,2}$' or abs(item.value::int)>20 or not exists(select from catalog where sku=item.key) then raise exception 'Invalid quantity or SKU'; end if;
  select coalesce((select qty from carts where owner=who and sku=item.key),0)+item.value::int into new_qty;
  if new_qty not between 0 and 20 then raise exception 'Quantity must be between 0 and 20'; end if;
  if new_qty=0 then delete from carts where owner=who and sku=item.key;
  else insert into carts values(who,item.key,new_qty) on conflict(owner,sku) do update set qty=excluded.qty; end if;
 end loop;
 if (select count(*) from carts where owner=who)>40 then raise exception 'Basket limit reached'; end if;
 insert into mutations values(who,token,changes);
end $$;

create function basket(who uuid) returns jsonb language sql stable set search_path=folio,pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('sku',sku,'title',title,'variant',variant,'qty',qty,'unit',unit_price(price,discount),'available',available) order by sku),'[]') from carts join catalog using(sku) where owner=who
$$;
create function my_basket() returns jsonb language sql stable security definer set search_path='' as $$select folio.basket(auth.uid())$$;
create function checkout(who uuid, request_id uuid, expected jsonb, address text, channel text) returns uuid language plpgsql security definer set search_path=folio,pg_catalog as $$
declare previous orders; snapshot jsonb; cost bigint; new_id uuid;
begin
 perform 1 from profiles where owner=who for update;
 select * into previous from orders where owner=who and attempt=request_id;
 if found then
  if previous.lines<>expected or previous.destination<>address or previous.method<>channel then raise exception 'Attempt conflict'; end if;
  return previous.id;
 end if;
 perform throttle('checkout-'||who,12);
 perform 1 from catalog join carts using(sku) where owner=who order by sku for share of catalog;
 snapshot:=basket(who);
 if snapshot='[]' or snapshot is distinct from expected then raise exception 'Basket changed. Review again.'; end if;
 if exists(select from jsonb_array_elements(snapshot) i where not (i->>'available')::boolean) then raise exception 'Item unavailable'; end if;
 select sum((i->>'qty')::bigint*(i->>'unit')::int) into cost from jsonb_array_elements(snapshot) i;
 insert into orders(owner,attempt,method,lines,subtotal,shipping_fee,tax,destination,quote) values(who,request_id,channel,snapshot,cost,0,0,address,md5(snapshot::text)) returning id into new_id;
 insert into events(order_id,kind,actor) values(new_id,'created','checkout');
 delete from carts where owner=who;
 return new_id;
end $$;

create function evidence(gateway_ref text, paid_amount bigint, currency text, transaction_ref text, outcome text) returns uuid language plpgsql security definer set search_path=folio,pg_catalog as $$
declare target orders; resulting text; linked uuid;
begin
 select * into strict target from orders where reference=gateway_ref for update;
 if target.method<>'online' or target.amount is distinct from paid_amount or currency is distinct from 'INR' or outcome is null or outcome not in ('declined','cancelled','captured','refunded','chargeback') or transaction_ref is null or transaction_ref !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'Evidence mismatch'; end if;
 insert into tracking values(transaction_ref,target.id) on conflict do nothing;
 select order_id into linked from tracking where ref=transaction_ref;
 if linked<>target.id then raise exception 'Reference conflict'; end if;
 if outcome in ('refunded','chargeback') and target.payment not in ('captured','refunded','chargeback') then raise exception 'Capture evidence required'; end if;
 insert into events(order_id,kind,actor,dedupe) values(target.id,outcome,'gateway',transaction_ref||':'||outcome) on conflict do nothing;
 if not found then return target.id; end if;
 resulting:=case when target.payment in ('refunded','chargeback') then target.payment when target.payment='captured' and outcome in ('declined','cancelled') then target.payment else outcome end;
 update orders set payment=resulting,phase=case when resulting in ('captured','refunded','chargeback') then 'resolved' else 'reconciling' end,updated_at=now() where id=target.id;
 return target.id;
end $$;
create function staff_action(target_id uuid, action text, reason text) returns void language plpgsql security definer set search_path=folio,pg_catalog as $$
declare o orders;
begin
 if not is_staff() or reason is null or length(trim(reason)) not between 3 and 200 then raise exception 'Staff and note required'; end if;
 select * into strict o from orders where id=target_id for update;
 if action='archive' then update orders set archived=true where id=o.id;
 elsif action='cod-collected' and o.method='cod' and o.payment='pending' and o.fulfilment='delivered' then update orders set payment='captured',phase='resolved' where id=o.id;
 elsif (action='packing' and o.fulfilment='new' and (o.method='cod' or o.payment='captured')) or (action='shipped' and o.fulfilment='packing' and (o.method='cod' or o.payment='captured')) or (action='delivered' and o.fulfilment='shipped') or (action='returned' and o.fulfilment='delivered') or (action='cancelled' and o.fulfilment in ('new','packing')) then update orders set fulfilment=action where id=o.id;
 else raise exception 'Transition unavailable'; end if;
 update orders set updated_at=now() where id=o.id;
 insert into events(order_id,kind,actor,note) values(o.id,action,auth.uid()::text,trim(reason));
end $$;
create function immutable() returns trigger language plpgsql as $$begin raise exception 'Financial history is retained'; end$$;
create trigger preserve_events before update or delete on events for each row execute function immutable();
create trigger preserve_orders before delete on orders for each row execute function immutable();
create function submit_message(category text, sender text, content text, agreed boolean, subject_hash text) returns void language plpgsql security definer set search_path=folio,pg_catalog as $$
begin
 if subject_hash is null or length(subject_hash) not between 16 and 128 or (category='contact' and length(trim(content))<3) then raise exception 'Invalid submission'; end if;
 perform throttle('message-'||subject_hash,5);
 insert into inbox(kind,email,message,consent) values(category,lower(trim(sender)),trim(content),agreed) on conflict do nothing;
end $$;
do $$declare t text; begin foreach t in array array['profiles','staff','catalog','carts','mutations','orders','tracking','events','reviews','inbox','limits'] loop execute format('alter table folio.%I enable row level security',t); end loop;end$$;
revoke all on all tables in schema folio from public,anon,authenticated,service_role;
revoke all on all sequences in schema folio from public,anon,authenticated,service_role;
revoke all on all functions in schema folio from public,anon,authenticated,service_role;
grant select on catalog to anon,authenticated;
create policy browse on catalog for select using(true);
grant select on profiles,carts,orders to authenticated;
create policy profile_owner on profiles for select using(owner=auth.uid());
create policy cart_owner on carts for select using(owner=auth.uid());
create policy order_owner on orders for select using(owner=auth.uid() or is_staff());
grant update(label) on profiles to authenticated;
create policy profile_label on profiles for update using(owner=auth.uid()) with check(owner=auth.uid());
grant select(id,sku,rating,body,published) on reviews to anon,authenticated;
create policy moderated on reviews for select using(published);
create policy staff_reviews on reviews for select to authenticated using(is_staff());
grant insert(owner,sku,rating,body),update(published) on reviews to authenticated;
grant usage on sequence reviews_id_seq to authenticated;
create policy write_review on reviews for insert to authenticated with check(owner=auth.uid());
create policy moderate on reviews for update to authenticated using(is_staff()) with check(is_staff());
grant insert,update(title,price,discount,available,revision) on catalog to authenticated;
create policy staff_products on catalog for insert to authenticated with check(is_staff());
create policy edit_products on catalog for update to authenticated using(is_staff()) with check(is_staff());
grant select,delete on inbox to authenticated;
create policy read_messages on inbox for select to authenticated using(is_staff());
create policy purge_messages on inbox for delete to authenticated using(is_staff());
grant select on events to authenticated;
create policy staff_events on events for select to authenticated using(is_staff());
grant execute on function is_staff(),my_basket(),change_cart(uuid,jsonb),staff_action(uuid,text,text) to authenticated;
grant execute on function unit_price(integer,integer) to anon,authenticated;
grant execute on function checkout(uuid,uuid,jsonb,text,text), evidence(text,bigint,text,text,text),submit_message(text,text,text,boolean,text) to service_role;
commit;
