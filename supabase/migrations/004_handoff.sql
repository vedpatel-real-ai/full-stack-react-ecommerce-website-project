begin;
alter table folio.orders add column gateway_started_at timestamptz;
alter table folio.orders add column disputed_evidence boolean not null default false;
create function folio.start_gateway(who uuid,target_id uuid) returns boolean language plpgsql security definer set search_path=folio,pg_catalog as $$
begin
 update orders set gateway_started_at=now(),updated_at=now() where id=target_id and owner=who and method='online' and payment='pending' and phase='awaiting' and gateway_started_at is null;
 return found;
end $$;
revoke all on function folio.start_gateway(uuid,uuid) from public,anon,authenticated;
grant execute on function folio.start_gateway(uuid,uuid) to service_role;
create function folio.guard_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if (old.id,old.owner,old.attempt,old.reference,old.method,old.lines,old.subtotal,old.shipping_fee,old.tax,old.destination,old.quote,old.created_at)
 is distinct from (new.id,new.owner,new.attempt,new.reference,new.method,new.lines,new.subtotal,new.shipping_fee,new.tax,new.destination,new.quote,new.created_at)
 then raise exception 'Order snapshot is immutable'; end if;
 if old.disputed_evidence or new.disputed_evidence then new.disputed_evidence:=true;new.phase:='reconciling';end if;
 return new;
end $$;
create trigger guard_snapshot before update on folio.orders for each row execute function folio.guard_snapshot();
create function folio.check_capture_reference() returns trigger language plpgsql set search_path=folio,pg_catalog as $$
begin
 if new.kind='captured' and new.actor='gateway' and exists(select from events where order_id=new.order_id and kind='captured' and actor='gateway' and id<>new.id) then
 update orders set disputed_evidence=true where id=new.order_id;
 end if;
 return new;
end $$;
create trigger check_capture after insert on folio.events for each row execute function folio.check_capture_reference();
revoke all on function folio.guard_snapshot(),folio.check_capture_reference() from public,anon,authenticated;
commit;
