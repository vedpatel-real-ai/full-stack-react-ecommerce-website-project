begin;
create table folio.catalog_media(sku text references folio.catalog,slot smallint check(slot between 1 and 4),webp bytea not null check(octet_length(webp) between 16 and 262144 and substring(webp from 1 for 4)=decode('52494646','hex') and substring(webp from 9 for 4)=decode('57454250','hex')),primary key(sku,slot));
alter table folio.catalog_media enable row level security;
revoke all on folio.catalog_media from public,anon,authenticated,service_role;
create function folio.images(edition text) returns table(slot smallint,encoded text) language sql stable security definer set search_path='' as $$
select m.slot,encode(m.webp,'base64') from folio.catalog_media m where sku=edition order by m.slot
$$;
create function folio.replace_image(who uuid,edition text,position smallint,encoded text) returns void language plpgsql security definer set search_path=folio,pg_catalog as $$
begin
 if not exists(select from staff where owner=who) or length(encoded)>350000 then raise exception 'Staff and bounded image required'; end if;
 perform throttle('media-'||who,30);
 insert into catalog_media values(edition,position,decode(encoded,'base64')) on conflict(sku,slot) do update set webp=excluded.webp;
end $$;
create function folio.remove_image(edition text,position smallint) returns void language plpgsql security definer set search_path=folio,pg_catalog as $$
begin if not is_staff() then raise exception 'Staff required';end if;delete from catalog_media where sku=edition and slot=position;end $$;
revoke all on function folio.images(text),folio.replace_image(uuid,text,smallint,text),folio.remove_image(text,smallint) from public,anon,authenticated;
grant execute on function folio.images(text) to anon,authenticated;
grant execute on function folio.remove_image(text,smallint) to authenticated;
grant execute on function folio.replace_image(uuid,text,smallint,text) to service_role;
commit;
