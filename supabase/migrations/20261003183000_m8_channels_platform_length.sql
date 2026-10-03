-- Channels: a platform name can be one letter ("X").
alter table public.channels drop constraint channels_platform_check;
alter table public.channels add constraint channels_platform_check check (char_length(btrim(platform)) between 1 and 60);
