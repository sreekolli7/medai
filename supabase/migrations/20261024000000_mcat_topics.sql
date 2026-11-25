-- Whole-MCAT structure: sections > topics. Parts, questions and tutor chunks each belong to a topic.

create table public.sections (
  id text primary key,
  name text not null,
  short_name text not null,
  sort_order int not null default 0
);
alter table public.sections enable row level security;
create policy "content read" on public.sections for select to anon, authenticated using (true);

create table public.topics (
  id text primary key,
  section_id text not null references public.sections (id) on delete cascade,
  name text not null,
  blurb text not null default '',
  sort_order int not null default 0,
  has_model boolean not null default false
);
alter table public.topics enable row level security;
create policy "content read" on public.topics for select to anon, authenticated using (true);

insert into public.sections (id, name, short_name, sort_order) values
  ('bb', 'Biology & Biochemistry', 'Bio/Biochem', 1),
  ('cp', 'Chemistry & Physics', 'Chem/Phys', 2),
  ('ps', 'Psychology & Sociology', 'Psych/Soc', 3),
  ('cars', 'Critical Analysis & Reasoning', 'CARS', 4);

insert into public.topics (id, section_id, name, blurb, sort_order, has_model) values
  ('amino-acids-proteins', 'bb', 'Amino acids, proteins & enzymes', 'Structure, folding, enzyme kinetics, inhibition', 1, false),
  ('dna-gene-expression', 'bb', 'DNA & gene expression', 'Replication, transcription, translation, regulation', 2, false),
  ('genetics-evolution', 'bb', 'Genetics & evolution', 'Mendelian genetics, Hardy-Weinberg, selection, drift', 3, false),
  ('metabolism', 'bb', 'Metabolism & bioenergetics', 'Glycolysis, citric acid cycle, oxidative phosphorylation', 4, false),
  ('cells-membranes', 'bb', 'Cells, membranes & the cell cycle', 'Organelles, transport, mitosis, meiosis', 5, false),
  ('microbes', 'bb', 'Bacteria, viruses & fungi', 'Prokaryotes, viral life cycles, gene transfer', 6, false),
  ('nervous-endocrine', 'bb', 'Nervous & endocrine systems', 'Neurons, action potentials, hormones', 7, false),
  ('heart', 'bb', 'Heart & circulation', 'Chambers, valves, blood flow, cardiac cycle', 8, true),
  ('respiratory', 'bb', 'Respiratory system', 'Lungs, gas exchange, oxygen transport', 9, false),
  ('digestive-renal', 'bb', 'Digestion & kidneys', 'Digestive tract, liver, nephron, fluid balance', 10, false),
  ('immune', 'bb', 'Immune system', 'Innate and adaptive immunity, antibodies, T cells', 11, false),
  ('muscle-bone-skin', 'bb', 'Muscle, bone & skin', 'Contraction, bone remodeling, skin', 12, false),
  ('reproduction-development', 'bb', 'Reproduction & development', 'Gametogenesis, menstrual cycle, embryology', 13, false),
  ('motion-forces', 'cp', 'Motion & forces', 'Kinematics, Newton''s laws, friction, torque', 1, false),
  ('work-energy', 'cp', 'Work, energy & momentum', 'Kinetic and potential energy, power, collisions', 2, false),
  ('fluids', 'cp', 'Fluids', 'Pressure, buoyancy, continuity, Bernoulli', 3, false),
  ('electricity-magnetism', 'cp', 'Electricity, circuits & magnetism', 'Charges, fields, circuits, magnetism', 4, false),
  ('waves-sound-light', 'cp', 'Waves, sound & optics', 'Sound, Doppler effect, refraction, lenses', 5, false),
  ('atoms-nuclear', 'cp', 'Atoms & nuclear decay', 'Electron structure, quantum numbers, radioactivity', 6, false),
  ('bonding-periodic', 'cp', 'Periodic table & bonding', 'Periodic trends, bonds, VSEPR, intermolecular forces', 7, false),
  ('gases-solutions', 'cp', 'Gases & solutions', 'Gas laws, solubility, colligative properties', 8, false),
  ('thermo-kinetics-equilibrium', 'cp', 'Thermodynamics, kinetics & equilibrium', 'Enthalpy, entropy, Gibbs energy, rates, Le Chatelier', 9, false),
  ('acids-bases', 'cp', 'Acids & bases', 'pH, Ka, buffers, titrations', 10, false),
  ('electrochemistry', 'cp', 'Redox & electrochemistry', 'Oxidation states, cells, electrode potentials', 11, false),
  ('organic', 'cp', 'Organic chemistry', 'Functional groups, stereochemistry, reactions', 12, false),
  ('lab-techniques', 'cp', 'Separations & spectroscopy', 'Chromatography, distillation, IR, NMR, electrophoresis', 13, false),
  ('sensation-perception', 'ps', 'Sensation & perception', 'Thresholds, vision, hearing, perception', 1, false),
  ('consciousness-sleep', 'ps', 'Consciousness, sleep & drugs', 'Sleep stages, circadian rhythm, psychoactive drugs', 2, false),
  ('learning-memory', 'ps', 'Learning & memory', 'Conditioning, observational learning, memory', 3, false),
  ('cognition-language', 'ps', 'Cognition & language', 'Problem solving, heuristics, biases, language', 4, false),
  ('emotion-motivation-stress', 'ps', 'Emotion, motivation & stress', 'Theories of emotion, motivation, stress response', 5, false),
  ('personality-disorders', 'ps', 'Personality & psychological disorders', 'Personality theories, major disorders', 6, false),
  ('development-identity', 'ps', 'Development & identity', 'Piaget, Erikson, attachment, self-concept', 7, false),
  ('social-psychology', 'ps', 'Social psychology', 'Attribution, conformity, obedience, group behavior', 8, false),
  ('sociological-theory', 'ps', 'Social structure & theory', 'Functionalism, conflict theory, interactionism', 9, false),
  ('culture-socialization', 'ps', 'Culture, norms & deviance', 'Culture, socialization, norms, deviance', 10, false),
  ('inequality-demographics', 'ps', 'Inequality & demographics', 'Stratification, mobility, demographic transition', 11, false),
  ('cars-passages', 'cars', 'Reading passages', 'Humanities and social science passages', 1, false);

-- "system" becomes a real topic reference.
alter table public.parts rename column system to topic_id;
alter table public.questions rename column system to topic_id;
alter table public.content_chunks rename column system to topic_id;
alter table public.questions alter column topic_id drop default;

-- OpenStax content is CC BY-NC-SA (non-commercial only), so it can't be used in a paid product.
delete from public.questions where source_name like 'OpenStax%';
delete from public.content_chunks where source_name like 'OpenStax%';

alter table public.parts add constraint parts_topic_fk foreign key (topic_id) references public.topics (id);
alter table public.questions add constraint questions_topic_fk foreign key (topic_id) references public.topics (id);
alter table public.content_chunks add constraint chunks_topic_fk foreign key (topic_id) references public.topics (id);
create index questions_topic_idx on public.questions (topic_id);
create index content_chunks_topic_idx on public.content_chunks (topic_id);

-- CARS questions share a passage.
alter table public.questions add column passage text;

create or replace function public.questions_text_changed()
returns trigger
language plpgsql
as $$
begin
  if new.prompt is distinct from old.prompt
     or new.passage is distinct from old.passage
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

-- Counts for the topic picker.
create view public.topic_stats
with (security_invoker = true) as
select t.id as topic_id,
       count(q.id) filter (where q.kind = 'mcq') as mcq_count,
       count(q.id) filter (where q.kind = 'mcq' and q.reviewed) as reviewed_mcq_count
from public.topics t
left join public.questions q on q.topic_id = t.id
group by t.id;

-- Spaced repetition for questions that aren't tied to a 3D part.
create table public.question_srs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  misses int not null default 0,
  correct_streak int not null default 0,
  interval_days numeric not null default 0,
  due_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.question_srs enable row level security;

create policy "own question srs read" on public.question_srs
  for select to authenticated using (user_id = auth.uid());
create policy "own question srs write" on public.question_srs
  for insert to authenticated with check (user_id = auth.uid());
create policy "own question srs update" on public.question_srs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Miss: due again in 10 minutes, streak resets. Correct: 1 day, then 3, then x2.5.
-- Questions about a 3D part schedule the part; every other question schedules itself.
drop function public.record_attempt(text, boolean);
create function public.record_attempt(p_question_id text, p_correct boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exists boolean;
  v_part text;
  v_streak int;
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

  if v_part is not null then
    insert into public.srs (user_id, part_id) values (auth.uid(), v_part) on conflict do nothing;
    select correct_streak, interval_days into v_streak, v_interval
    from public.srs where user_id = auth.uid() and part_id = v_part for update;
  else
    insert into public.question_srs (user_id, question_id) values (auth.uid(), p_question_id) on conflict do nothing;
    select correct_streak, interval_days into v_streak, v_interval
    from public.question_srs where user_id = auth.uid() and question_id = p_question_id for update;
  end if;

  v_interval := case
    when not p_correct then 0
    when v_streak = 0 then 1
    when v_streak = 1 then 3
    else round(v_interval * 2.5, 1)
  end;

  if v_part is not null then
    update public.srs
      set misses = misses + (not p_correct)::int,
          correct_streak = case when p_correct then correct_streak + 1 else 0 end,
          interval_days = v_interval,
          due_at = case when p_correct then now() + make_interval(secs => v_interval * 86400)
                        else now() + interval '10 minutes' end
      where user_id = auth.uid() and part_id = v_part;
  else
    update public.question_srs
      set misses = misses + (not p_correct)::int,
          correct_streak = case when p_correct then correct_streak + 1 else 0 end,
          interval_days = v_interval,
          due_at = case when p_correct then now() + make_interval(secs => v_interval * 86400)
                        else now() + interval '10 minutes' end
      where user_id = auth.uid() and question_id = p_question_id;
  end if;
end;
$$;

-- Heart notes now live under the 3D anatomy screen.
update public.content_chunks
set source_url = replace(source_url, '/?part=', '/anatomy/heart/learn?part=')
where source_url like '/?part=%';

update public.content_chunks
set source_name = 'MedAi draft notes', license = 'Original MedAi draft (unreviewed)'
where source_name = 'HeartTutor draft notes';
