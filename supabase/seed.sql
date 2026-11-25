-- Placeholder heart content (topic 'heart'). DRAFT ONLY: everything is reviewed = false and must be
-- checked by a qualified human reviewer before it shows as "Verified".

insert into public.parts (id, topic_id, name, side, blood, sort_order, explanation, exam_pearl) values
('superior-vena-cava', 'heart', 'Superior vena cava', 'right', 'oxygen-poor', 1,
 'A large vein that returns oxygen-poor blood from the head, neck, and arms to the right atrium.',
 'The inferior vena cava drains the lower body. Both venae cavae empty into the right atrium.'),
('right-atrium', 'heart', 'Right atrium', 'right', 'oxygen-poor', 2,
 'Collects oxygen-poor blood from the body (via the venae cavae) and passes it through the tricuspid valve into the right ventricle.',
 'The SA node, the heart''s natural pacemaker, sits in the wall of the right atrium.'),
('right-ventricle', 'heart', 'Right ventricle', 'right', 'oxygen-poor', 3,
 'Pumps oxygen-poor blood through the pulmonary valve into the pulmonary artery, which carries it to the lungs.',
 'Its wall is thinner than the left ventricle''s because the lungs are a low-pressure circuit, yet both ventricles pump the same volume per beat.'),
('pulmonary-artery', 'heart', 'Pulmonary artery', null, 'oxygen-poor', 4,
 'Carries oxygen-poor blood from the right ventricle to the lungs to pick up oxygen.',
 'Arteries carry blood away from the heart, not necessarily oxygen-rich blood. The pulmonary arteries carry oxygen-poor blood.'),
('pulmonary-veins', 'heart', 'Pulmonary veins', 'left', 'oxygen-rich', 5,
 'Bring oxygen-rich blood back from the lungs into the left atrium.',
 'Veins carry blood toward the heart. The pulmonary veins are the veins that carry oxygen-rich blood.'),
('left-atrium', 'heart', 'Left atrium', 'left', 'oxygen-rich', 6,
 'Receives oxygen-rich blood from the pulmonary veins and passes it through the mitral (bicuspid) valve into the left ventricle.',
 'Remember the valve order: tricuspid on the right, mitral (bicuspid) on the left.'),
('left-ventricle', 'heart', 'Left ventricle', 'left', 'oxygen-rich', 7,
 'Pumps oxygen-rich blood through the aortic valve into the aorta and out to the whole body.',
 'It has the thickest wall of any chamber because it pumps against the high pressure of the systemic circulation.'),
('aorta', 'heart', 'Aorta', 'left', 'oxygen-rich', 8,
 'The body''s largest artery. It carries oxygen-rich blood from the left ventricle to the rest of the body.',
 'The coronary arteries, which feed the heart muscle itself, are the first branches off the aorta.')
on conflict (id) do nothing;

insert into public.questions (id, topic_id, kind, part_id, prompt, correct_part_id, difficulty) values
('q-svc-1', 'heart', 'tap', 'superior-vena-cava', 'Which vessel returns blood from the head and arms to the heart?', 'superior-vena-cava', 1),
('q-ra-1', 'heart', 'tap', 'right-atrium', 'Which chamber receives blood from the superior vena cava?', 'right-atrium', 1),
('q-ra-2', 'heart', 'tap', 'right-atrium', 'Which chamber holds the SA node, the heart''s pacemaker?', 'right-atrium', 2),
('q-rv-1', 'heart', 'tap', 'right-ventricle', 'Which chamber pumps blood into the pulmonary artery?', 'right-ventricle', 1),
('q-rv-2', 'heart', 'tap', 'right-ventricle', 'Blood passes through the tricuspid valve into which chamber?', 'right-ventricle', 2),
('q-pa-1', 'heart', 'tap', 'pulmonary-artery', 'Which artery carries oxygen-poor blood?', 'pulmonary-artery', 2),
('q-pv-1', 'heart', 'tap', 'pulmonary-veins', 'Which vessels bring oxygen-rich blood from the lungs back to the heart?', 'pulmonary-veins', 1),
('q-la-1', 'heart', 'tap', 'left-atrium', 'Which chamber receives blood from the pulmonary veins?', 'left-atrium', 1),
('q-la-2', 'heart', 'tap', 'left-atrium', 'Blood leaving the lungs enters which chamber first?', 'left-atrium', 2),
('q-lv-1', 'heart', 'tap', 'left-ventricle', 'Which chamber has the thickest wall?', 'left-ventricle', 1),
('q-lv-2', 'heart', 'tap', 'left-ventricle', 'Blood passes through the mitral valve into which chamber?', 'left-ventricle', 2),
('q-ao-1', 'heart', 'tap', 'aorta', 'Which vessel carries oxygen-rich blood from the left ventricle to the body?', 'aorta', 1),
('q-ao-2', 'heart', 'tap', 'aorta', 'The coronary arteries branch off which vessel?', 'aorta', 3)
on conflict (id) do nothing;

-- Retrieval chunks for the AI tutor, built from the same draft text.
insert into public.content_chunks (topic_id, title, body, source_name, source_url, license)
select p.topic_id, p.name, p.explanation || ' Exam pearl: ' || p.exam_pearl,
       'MedAi draft notes', '/anatomy/heart/learn?part=' || p.id,
       'Original MedAi draft (unreviewed)'
from public.parts p
where not exists (select 1 from public.content_chunks c where c.title = p.name);
