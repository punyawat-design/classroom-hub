-- Classroom Hub v6 migration
-- Run this ONCE in Supabase SQL Editor for an existing Classroom Hub database.

-- 1) Create student profile automatically when a student signs up by email.
create or replace function public.handle_new_student_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,full_name,role,student_code)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,''),'@',1)),
    'student',
    nullif(new.raw_user_meta_data->>'student_code','')
  )
  on conflict (id) do update
  set full_name=excluded.full_name,
      student_code=coalesce(excluded.student_code,public.profiles.student_code);
  return new;
end;
$$;

-- Common Supabase projects use this trigger name.
do $$
begin
  if not exists(
    select 1 from pg_trigger
    where tgname='on_auth_user_created'
      and tgrelid='auth.users'::regclass
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_student_signup();
  end if;
end $$;

-- 2) Assignment overview now returns course_id so the student UI can group work by subject.
drop function if exists public.student_assignment_overview(uuid);
create function public.student_assignment_overview(p_student_id uuid)
returns table(
  assignment_id uuid,course_id uuid,title text,course_name text,classroom_name text,due_at timestamptz,
  max_score numeric,submitted_at timestamptz,score numeric,computed_status public.submission_status
)
language sql stable security definer set search_path=public as $$
  select a.id,c.id,a.title,c.name,cl.name,a.due_at,a.max_score,s.submitted_at,s.score,
    case
      when s.status='REVISION_REQUIRED' then 'REVISION_REQUIRED'::public.submission_status
      when s.status='GRADED' then 'GRADED'::public.submission_status
      when s.submitted_at is not null and s.submitted_at>a.due_at then 'LATE'::public.submission_status
      when s.submitted_at is not null then 'WAITING_REVIEW'::public.submission_status
      when s.status='IN_PROGRESS' then 'IN_PROGRESS'::public.submission_status
      when now()>a.due_at then 'OVERDUE'::public.submission_status
      else 'NOT_STARTED'::public.submission_status end
  from public.assignments a
  join public.courses c on c.id=a.course_id
  join public.classrooms cl on cl.id=a.classroom_id
  join public.classroom_students cs on cs.classroom_id=a.classroom_id and cs.student_id=p_student_id
  left join public.submissions s on s.assignment_id=a.id and s.student_id=p_student_id
  where p_student_id=auth.uid() or public.is_teacher(auth.uid())
  order by c.name,a.due_at;
$$;

-- 3) Pending submissions now include course_id/course_name so teachers can review by subject.
drop function if exists public.teacher_pending_submissions();
create function public.teacher_pending_submissions()
returns table(
  submission_id uuid,student_id uuid,student_code text,full_name text,
  course_id uuid,course_name text,assignment_title text,max_score numeric,
  submitted_at timestamptz,student_note text,submission_link text,score numeric,
  teacher_feedback text,computed_status public.submission_status,files jsonb
)
language sql stable security definer set search_path=public as $$
  select s.id,p.id,p.student_code,p.full_name,c.id,c.name,a.title,a.max_score,
    s.submitted_at,s.student_note,s.submission_link,s.score,s.teacher_feedback,
    case when s.submitted_at>a.due_at then 'LATE'::public.submission_status else 'WAITING_REVIEW'::public.submission_status end,
    coalesce((
      select jsonb_agg(jsonb_build_object('file_name',sf.file_name,'storage_path',sf.storage_path))
      from public.submission_files sf where sf.submission_id=s.id
    ),'[]'::jsonb)
  from public.submissions s
  join public.assignments a on a.id=s.assignment_id
  join public.courses c on c.id=a.course_id
  join public.profiles p on p.id=s.student_id
  where a.teacher_id=auth.uid() and s.status in ('WAITING_REVIEW','LATE')
  order by c.name,s.submitted_at;
$$;


-- 4) Allow an authenticated student to repair only their own student profile.
drop policy if exists "student self profile insert v6" on public.profiles;
create policy "student self profile insert v6" on public.profiles
for insert to authenticated
with check (id=auth.uid() and role='student');

drop policy if exists "student self profile update v6" on public.profiles;
create policy "student self profile update v6" on public.profiles
for update to authenticated
using (id=auth.uid() and role='student')
with check (id=auth.uid() and role='student');
