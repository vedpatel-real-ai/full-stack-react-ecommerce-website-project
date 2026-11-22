begin;
create function folio.claim_due(batch_size integer) returns table(reference text,checks integer) language sql security definer set search_path=folio,pg_catalog as $$
 with due as (select o.id from orders o where o.method='online' and phase<>'resolved' and o.checks<5 and next_check<=now() order by next_check limit least(greatest(coalesce(batch_size,0),0),25) for update skip locked)
 update orders o set checks=o.checks+1,phase='reconciling',next_check=now()+(interval '15 minutes'*(1<<o.checks)) from due where o.id=due.id returning o.reference,o.checks
$$;
revoke all on function folio.claim_due(integer) from public,anon,authenticated;
grant execute on function folio.claim_due(integer) to service_role;
commit;
