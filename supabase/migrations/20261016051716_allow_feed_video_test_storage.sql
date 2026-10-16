-- Applied only to TEST ahyyknfjsielnqyoxqgh. Not a Production rollout authorization.
-- Private bucket, 15 MiB size limit and all ownership policies are preserved.
do $$ begin
  if not exists(select 1 from storage.buckets where id='social-media' and public=false and file_size_limit=15728640) then
    raise exception 'Unexpected social-media bucket configuration';
  end if;
end $$;
update storage.buckets
set allowed_mime_types=array(
  select distinct mime
  from unnest(allowed_mime_types || array['video/mp4','video/quicktime','video/webm']) mime
  order by mime
)
where id='social-media';
