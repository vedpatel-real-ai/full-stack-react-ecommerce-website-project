begin;
create function folio.request_refund(target_id uuid,reason text) returns void language plpgsql security definer set search_path=folio,pg_catalog as $$
declare o orders;
begin
 if not is_staff() or reason is null or length(trim(reason)) not between 3 and 200 then raise exception 'Staff and note required'; end if;
 select * into strict o from orders where id=target_id for update;
 if o.payment<>'captured' then raise exception 'Capture evidence required'; end if;
 insert into events(order_id,kind,actor,note,dedupe) values(o.id,'refund-requested',auth.uid()::text,trim(reason),'staff:refund-request') on conflict do nothing;
end $$;
revoke all on function folio.request_refund(uuid,text) from public,anon,authenticated;
grant execute on function folio.request_refund(uuid,text) to authenticated;
commit;
