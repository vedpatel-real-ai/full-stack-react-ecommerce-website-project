begin;
grant select(id,reference,amount,owner,method,payment,phase) on folio.orders to service_role;
create policy service_lookup on folio.orders for select to service_role using(true);
create function folio.catalog_version() returns trigger language plpgsql as $$
begin new.revision:=old.revision+1;return new;end$$;
create trigger catalog_version before update on folio.catalog for each row execute function folio.catalog_version();
revoke all on function folio.catalog_version() from public,anon,authenticated;
create function folio.review_limit() returns trigger language plpgsql security definer set search_path='' as $$
begin perform folio.throttle('review-'||new.owner,6); return new;end$$;
create trigger limited_review before insert on folio.reviews for each row execute function folio.review_limit();
revoke all on function folio.review_limit() from public,anon,authenticated;
commit;
