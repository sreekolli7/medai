-- HeartTutor initial schema. RLS is enabled on every table.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Admins (reviewers). Only writable with the service role / SQL editor.
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create policy "admins see themselves" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  exam text not null default 'MCAT'
);
alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Subscriptions (written only by the Stripe webhook via service role)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('active', 'trialing', 'canceled', 'past_due', 'incomplete', 'unpaid')),
  plan text not null default 'paid',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;

create policy "own subscription read" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Content: parts, questions, content_chunks (read-only to users)
-- ---------------------------------------------------------------------------
create table public.parts (
  id text primary key,
  system text not null,
  name text not null,
  side text check (side in ('left', 'right')),
  blood text not null check (blood in ('oxygen-poor', 'oxygen-rich')),
  sort_order int not null default 0,
  explanation text not null,
  exam_pearl text not null,
  audio_url text,
  reviewed boolean not null default false,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.parts enable row level security;

create table public.questions (
  id text primary key default gen_random_uuid()::text,
  part_id text not null references public.parts (id) on delete cascade,
  prompt text not null,
  correct_part_id text not null references public.parts (id) on delete cascade,
  difficulty int not null default 1 check (difficulty between 1 and 3),
  reviewed boolean not null default false,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz
);
alter table public.questions enable row level security;

create table public.content_chunks (
  id bigint generated always as identity primary key,
  system text not null,
  title text not null,
  body text not null,
  source_name text not null,
  source_url text,
  license text not null,
  reviewed boolean not null default false,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  embedding extensions.vector(512),
  created_at timestamptz not null default now()
);
alter table public.content_chunks enable row level security;

create index content_chunks_embedding_idx on public.content_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Everyone (including signed-out visitors) can read content; only admins can change it.
create policy "content read" on public.parts for select to anon, authenticated using (true);
create policy "content admin update" on public.parts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "content read" on public.questions for select to anon, authenticated using (true);
create policy "content admin update" on public.questions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "content admin delete" on public.questions for delete to authenticated
  using (public.is_admin());

create policy "content read" on public.content_chunks for select to anon, authenticated using (true);
create policy "content admin update" on public.content_chunks for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "content admin delete" on public.content_chunks for delete to authenticated
  using (public.is_admin());

-- Editing text un-verifies the item and invalidates cached audio / embeddings.
create or replace function public.parts_text_changed()
returns trigger
language plpgsql
as $$
begin
  if new.explanation is distinct from old.explanation
     or new.exam_pearl is distinct from old.exam_pearl
     or new.name is distinct from old.name then
    new.reviewed := false;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.audio_url := null;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger parts_text_changed before update on public.parts
  for each row execute function public.parts_text_changed();

create or replace function public.questions_text_changed()
returns trigger
language plpgsql
as $$
begin
  if new.prompt is distinct from old.prompt
     or new.correct_part_id is distinct from old.correct_part_id then
    new.reviewed := false;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
create trigger questions_text_changed before update on public.questions
  for each row execute function public.questions_text_changed();

create or replace function public.chunks_text_changed()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body or new.title is distinct from old.title then
    new.reviewed := false;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.embedding := null;
  end if;
  return new;
end;
$$;
create trigger chunks_text_changed before update on public.content_chunks
  for each row execute function public.chunks_text_changed();

-- ---------------------------------------------------------------------------
-- Attempts + spaced repetition (own rows only)
-- ---------------------------------------------------------------------------
create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  correct boolean not null,
  created_at timestamptz not null default now()
);
alter table public.attempts enable row level security;
create index attempts_user_idx on public.attempts (user_id, created_at desc);

create policy "own attempts read" on public.attempts
  for select to authenticated using (user_id = auth.uid());
create policy "own attempts insert" on public.attempts
  for insert to authenticated with check (user_id = auth.uid());

create table public.srs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  part_id text not null references public.parts (id) on delete cascade,
  misses int not null default 0,
  correct_streak int not null default 0,
  interval_days numeric not null default 0,
  due_at timestamptz not null default now(),
  primary key (user_id, part_id)
);
alter table public.srs enable row level security;

create policy "own srs read" on public.srs
  for select to authenticated using (user_id = auth.uid());
create policy "own srs write" on public.srs
  for insert to authenticated with check (user_id = auth.uid());
create policy "own srs update" on public.srs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Records an answer and updates the spaced-repetition schedule for the question's part.
-- Miss: due again in 10 minutes, streak resets. Correct: 1 day, then 3, then x2.5.
create or replace function public.record_attempt(p_question_id text, p_correct boolean)
returns public.srs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_part text;
  v_row public.srs;
  v_interval numeric;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select correct_part_id into v_part from public.questions where id = p_question_id;
  if v_part is null then
    raise exception 'unknown question';
  end if;

  insert into public.attempts (user_id, question_id, correct)
  values (auth.uid(), p_question_id, p_correct);

  insert into public.srs (user_id, part_id) values (auth.uid(), v_part)
  on conflict do nothing;

  select * into v_row from public.srs where user_id = auth.uid() and part_id = v_part for update;

  if p_correct then
    v_interval := case
      when v_row.correct_streak = 0 then 1
      when v_row.correct_streak = 1 then 3
      else round(v_row.interval_days * 2.5, 1)
    end;
    update public.srs
      set correct_streak = correct_streak + 1,
          interval_days = v_interval,
          due_at = now() + make_interval(secs => v_interval * 86400)
      where user_id = auth.uid() and part_id = v_part
      returning * into v_row;
  else
    update public.srs
      set misses = misses + 1,
          correct_streak = 0,
          interval_days = 0,
          due_at = now() + interval '10 minutes'
      where user_id = auth.uid() and part_id = v_part
      returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usage + spend tracking (written only by Edge Functions via service role)
-- ---------------------------------------------------------------------------
create table public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  model text not null,
  replies int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  primary key (user_id, day, model)
);
alter table public.usage enable row level security;

create policy "own usage read" on public.usage
  for select to authenticated using (user_id = auth.uid());

create or replace function public.log_usage(
  p_user_id uuid, p_model text, p_input bigint, p_output bigint, p_cost numeric
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.usage (user_id, day, model, replies, input_tokens, output_tokens, cost_usd)
  values (p_user_id, current_date, p_model, 1, p_input, p_output, p_cost)
  on conflict (user_id, day, model) do update set
    replies = public.usage.replies + 1,
    input_tokens = public.usage.input_tokens + excluded.input_tokens,
    output_tokens = public.usage.output_tokens + excluded.output_tokens,
    cost_usd = public.usage.cost_usd + excluded.cost_usd;
$$;
revoke execute on function public.log_usage from public, anon, authenticated;

create table public.spend_alerts (
  day date primary key,
  total_usd numeric(12, 4) not null,
  threshold_usd numeric(12, 4) not null,
  created_at timestamptz not null default now()
);
alter table public.spend_alerts enable row level security;
create policy "admin read alerts" on public.spend_alerts
  for select to authenticated using (public.is_admin());

create or replace view public.daily_spend
with (security_invoker = true) as
  select day, model, sum(replies) as replies, sum(input_tokens) as input_tokens,
         sum(output_tokens) as output_tokens, sum(cost_usd) as cost_usd
  from public.usage
  group by day, model;

create policy "admin read all usage" on public.usage
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reports ("This looks wrong")
-- ---------------------------------------------------------------------------
create table public.reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('part', 'question', 'tutor_answer', 'chunk')),
  target_id text,
  text_shown text not null,
  note text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create policy "own reports read" on public.reports
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "own reports insert" on public.reports
  for insert to authenticated with check (user_id = auth.uid() and status = 'open');
create policy "admin reports update" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Vector search (called by the tutor Edge Function)
-- ---------------------------------------------------------------------------
create or replace function public.match_chunks(
  query_embedding extensions.vector(512),
  match_count int default 5,
  only_reviewed boolean default true
)
returns table (id bigint, title text, body text, source_name text, source_url text, reviewed boolean, similarity float)
language sql
stable
set search_path = ''
as $$
  select c.id, c.title, c.body, c.source_name, c.source_url, c.reviewed,
         1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.content_chunks c
  where c.embedding is not null
    and (not only_reviewed or c.reviewed)
  order by c.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Storage bucket for pre-generated audio (public read, service-role write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;
