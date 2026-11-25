-- Multiple-choice questions alongside tap-the-diagram questions, with source + license.

alter table public.questions
  add column system text not null default 'heart',
  add column kind text not null default 'tap' check (kind in ('tap', 'mcq')),
  add column choices jsonb,
  add column answer_index int,
  add column answer_explanation text,
  add column source_name text,
  add column source_url text,
  add column license text,
  alter column part_id drop not null,
  alter column correct_part_id drop not null;

alter table public.questions
  add constraint questions_kind_shape check (
    (kind = 'tap' and correct_part_id is not null)
    or (kind = 'mcq' and jsonb_typeof(choices) = 'array' and answer_index is not null)
  );

create or replace function public.questions_text_changed()
returns trigger
language plpgsql
as $$
begin
  if new.prompt is distinct from old.prompt
     or new.correct_part_id is distinct from old.correct_part_id
     or new.choices is distinct from old.choices
     or new.answer_index is distinct from old.answer_index
     or new.answer_explanation is distinct from old.answer_explanation then
    new.reviewed := false;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

-- Attempts on questions tied to a part feed spaced repetition; general questions are only logged.
create or replace function public.record_attempt(p_question_id text, p_correct boolean)
returns public.srs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_part text;
  v_exists boolean;
  v_row public.srs;
  v_interval numeric;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select true, coalesce(correct_part_id, part_id) into v_exists, v_part
  from public.questions where id = p_question_id;
  if v_exists is null then
    raise exception 'unknown question';
  end if;

  insert into public.attempts (user_id, question_id, correct)
  values (auth.uid(), p_question_id, p_correct);

  if v_part is null then
    return null;
  end if;

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
