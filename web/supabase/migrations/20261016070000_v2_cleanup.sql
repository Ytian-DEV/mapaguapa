-- MAPAGUAPA v2 — cleanup
-- * Drops the v1 enum types public.user_role and public.listing_status.
--   Migrations 1 and 2 converted profiles.role and listings.status to text,
--   so nothing should reference them. Each type is dropped only when no
--   column, function argument/result or other object still depends on it;
--   otherwise a NOTICE says why it was kept (no CASCADE, nothing else is dropped).
-- * profiles_guard keeps rewriting a legacy 'user' role to 'student' on
--   purpose: browsers still running the cached v1 bundle on deploy day can
--   keep signing up. It is harmless once they are gone.
-- Requires migrations 1-6. Safe to re-run.

do $$
declare
  v_type text;
  v_oid oid;
  v_uses integer;
begin
  foreach v_type in array array['user_role', 'listing_status'] loop
    select t.oid into v_oid
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = v_type;

    if v_oid is null then
      continue;
    end if;

    -- Dependencies other than the type's own array type.
    select count(*) into v_uses
    from pg_depend d
    where d.refobjid = v_oid
      and d.deptype = 'n'
      and not (d.classid = 'pg_type'::regclass and d.objid = (select typarray from pg_type where oid = v_oid));

    if v_uses = 0 then
      execute format('drop type public.%I', v_type);
    else
      raise notice 'Kept type public.% (% dependent objects).', v_type, v_uses;
    end if;
  end loop;
end
$$;
