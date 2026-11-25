-- More 3D models (brain, eye, torso, skeleton). Parts now belong to a model, and only heart
-- parts carry an oxygen-rich / oxygen-poor color.

alter table public.parts alter column blood drop not null;
alter table public.parts add column model text not null default 'heart';
alter table public.parts alter column model drop default;
create index parts_model_idx on public.parts (model, sort_order);

-- Multiple-choice questions can point at the structure they're about, for a "see it in 3D" view.
-- Kept separate from part_id / correct_part_id, which route attempts into the per-part tap-quiz schedule.
alter table public.questions
  add column related_part_id text references public.parts (id) on delete set null;
create index questions_related_part_idx on public.questions (related_part_id);

update public.topics set has_model = true
where id in (
  'nervous-endocrine', 'respiratory', 'digestive-renal', 'immune', 'muscle-bone-skin',
  'reproduction-development', 'sensation-perception', 'learning-memory', 'consciousness-sleep',
  'cognition-language', 'emotion-motivation-stress'
);
