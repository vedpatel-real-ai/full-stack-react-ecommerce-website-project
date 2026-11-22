begin;
create table folio.price_policy(singleton boolean primary key default true check(singleton),shipping_paise integer not null check(shipping_paise between 0 and 1000000),added_tax_bps integer not null check(added_tax_bps between 0 and 10000));
insert into folio.price_policy values(true,0,0);
alter table folio.price_policy enable row level security;
revoke all on folio.price_policy from public,anon,authenticated,service_role;
grant select on folio.price_policy to anon,authenticated;
create policy public_terms on folio.price_policy for select using(true);
create function folio.attach_terms() returns trigger language plpgsql set search_path=folio,pg_catalog as $$
declare policy price_policy;
begin
 select * into strict policy from price_policy for share;
 new.shipping_fee:=policy.shipping_paise;
 new.tax:=(new.subtotal*policy.added_tax_bps+5000)/10000;
 return new;
end $$;
create trigger attach_terms before insert on folio.orders for each row execute function folio.attach_terms();
create function folio.quoted_checkout(who uuid,request_id uuid,expected jsonb,address text,channel text,terms jsonb) returns uuid language plpgsql security definer set search_path=folio,pg_catalog as $$
declare result uuid;policy price_policy; previous orders;
begin
 perform 1 from profiles where owner=who for update;
 select * into previous from orders where owner=who and attempt=request_id;
 if not found then
  select * into strict policy from price_policy for share;
  if terms is distinct from jsonb_build_object('shipping',policy.shipping_paise,'taxBps',policy.added_tax_bps) then raise exception 'Basket changed. Review again.';end if;
 end if;
 result:=checkout(who,request_id,expected,address,channel);
 return result;
end $$;
revoke all on function folio.attach_terms(),folio.quoted_checkout(uuid,uuid,jsonb,text,text,jsonb) from public,anon,authenticated;
revoke execute on function folio.checkout(uuid,uuid,jsonb,text,text) from service_role;
grant execute on function folio.quoted_checkout(uuid,uuid,jsonb,text,text,jsonb) to service_role;
commit;
