-- Classroom Hub v2 - Fresh Supabase schema
-- Run this on a NEW Supabase project via SQL Editor.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('teacher','student');
create type public.submission_status as enum (
  'NOT_STARTED','IN_PROGRESS','WAITING_REVIEW','GRADED','REVISION_REQUIRED','LATE','OVERDUE'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null,
  student_code text unique,
  created_at timestamptz not null default now()
);


-- Auto-create student profile for public email signup.
create or replace function public.handle_new_student_signup()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,role,student_code)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(coalesce(new.email,''),'@',1)),
    'student',
    nullif(new.raw_user_meta_data->>'student_code','')
  )
  on conflict (id) do update
  set full_name=excluded.full_name,
      student_code=coalesce(excluded.student_code,public.profiles.student_code);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_student_signup();

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.classroom_students (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (classroom_id, student_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.course_classrooms (
  course_id uuid not null references public.courses(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  primary key (course_id, classroom_id)
);

create table public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text default '',
  link_url text,
  file_name text,
  storage_path text,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  instructions text default '',
  course_id uuid not null references public.courses(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  open_at timestamptz not null,
  due_at timestamptz not null,
  max_score numeric(10,2) not null default 10 check (max_score >= 0),
  allow_late_submission boolean not null default true,
  allow_resubmission boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.submission_status not null default 'NOT_STARTED',
  started_at timestamptz,
  submitted_at timestamptz,
  is_late boolean not null default false,
  student_note text default '',
  submission_link text,
  score numeric(10,2),
  teacher_feedback text default '',
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  file_type text,
  uploaded_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_classroom_students_student on public.classroom_students(student_id);
create index idx_assignments_classroom_due on public.assignments(classroom_id,due_at);
create index idx_submissions_student on public.submissions(student_id);
create index idx_submissions_assignment on public.submissions(assignment_id);
create index idx_materials_course on public.learning_materials(course_id);

-- ===== SECURITY HELPERS =====
create or replace function public.is_teacher(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=p_user and role='teacher');
$$;

create or replace function public.teacher_owns_classroom(p_classroom uuid, p_teacher uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.classrooms where id=p_classroom and teacher_id=p_teacher);
$$;

create or replace function public.teacher_owns_course(p_course uuid, p_teacher uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.courses where id=p_course and teacher_id=p_teacher);
$$;

create or replace function public.student_in_classroom(p_classroom uuid, p_student uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.classroom_students where classroom_id=p_classroom and student_id=p_student);
$$;

create or replace function public.student_in_course(p_course uuid, p_student uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.course_classrooms cc
    join public.classroom_students cs on cs.classroom_id=cc.classroom_id
    where cc.course_id=p_course and cs.student_id=p_student
  );
$$;

-- ===== APP RPCs =====
create or replace function public.teacher_classroom_students(p_classroom_id uuid)
returns table(student_id uuid,student_code text,full_name text)
language sql stable security definer set search_path=public as $$
  select p.id,p.student_code,p.full_name
  from public.classroom_students cs
  join public.profiles p on p.id=cs.student_id
  where cs.classroom_id=p_classroom_id
    and public.teacher_owns_classroom(p_classroom_id,auth.uid())
  order by p.student_code nulls last,p.full_name;
$$;

create or replace function public.teacher_enroll_student_by_code(p_classroom_id uuid,p_student_code text)
returns text language plpgsql security definer set search_path=public as $$
declare v_student uuid; v_name text;
begin
  if not public.teacher_owns_classroom(p_classroom_id,auth.uid()) then
    raise exception 'ไม่มีสิทธิ์จัดการห้องนี้';
  end if;
  select id,full_name into v_student,v_name from public.profiles
  where student_code=p_student_code and role='student';
  if v_student is null then raise exception 'ไม่พบนักเรียนรหัส %',p_student_code; end if;
  insert into public.classroom_students(classroom_id,student_id)
  values(p_classroom_id,v_student) on conflict do nothing;
  return 'เพิ่ม '||v_name||' เข้าห้องแล้ว';
end; $$;

create or replace function public.student_assignment_overview(p_student_id uuid)
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
  order by a.due_at;
$$;

create or replace function public.teacher_assignment_tracking(p_assignment_id uuid)
returns table(student_id uuid,student_code text,full_name text,submitted_at timestamptz,score numeric,computed_status public.submission_status)
language sql stable security definer set search_path=public as $$
  select p.id,p.student_code,p.full_name,s.submitted_at,s.score,
    case
      when s.status='REVISION_REQUIRED' then 'REVISION_REQUIRED'::public.submission_status
      when s.status='GRADED' then 'GRADED'::public.submission_status
      when s.submitted_at is not null and s.submitted_at>a.due_at then 'LATE'::public.submission_status
      when s.submitted_at is not null then 'WAITING_REVIEW'::public.submission_status
      when s.status='IN_PROGRESS' then 'IN_PROGRESS'::public.submission_status
      when now()>a.due_at then 'OVERDUE'::public.submission_status
      else 'NOT_STARTED'::public.submission_status end
  from public.assignments a
  join public.classroom_students cs on cs.classroom_id=a.classroom_id
  join public.profiles p on p.id=cs.student_id
  left join public.submissions s on s.assignment_id=a.id and s.student_id=p.id
  where a.id=p_assignment_id and a.teacher_id=auth.uid()
  order by p.student_code nulls last,p.full_name;
$$;

create or replace function public.classroom_assignment_matrix(p_classroom_id uuid)
returns table(student_id uuid,full_name text,assignment_id uuid,assignment_title text,computed_status public.submission_status)
language sql stable security definer set search_path=public as $$
  select p.id,p.full_name,a.id,a.title,
    case
      when s.status='REVISION_REQUIRED' then 'REVISION_REQUIRED'::public.submission_status
      when s.status='GRADED' then 'GRADED'::public.submission_status
      when s.submitted_at is not null and s.submitted_at>a.due_at then 'LATE'::public.submission_status
      when s.submitted_at is not null then 'WAITING_REVIEW'::public.submission_status
      when s.status='IN_PROGRESS' then 'IN_PROGRESS'::public.submission_status
      when now()>a.due_at then 'OVERDUE'::public.submission_status
      else 'NOT_STARTED'::public.submission_status end
  from public.classroom_students cs
  join public.profiles p on p.id=cs.student_id
  join public.assignments a on a.classroom_id=cs.classroom_id
  left join public.submissions s on s.assignment_id=a.id and s.student_id=p.id
  where cs.classroom_id=p_classroom_id and a.teacher_id=auth.uid()
  order by p.full_name,a.due_at;
$$;

create or replace function public.teacher_pending_submissions()
returns table(
  submission_id uuid,student_id uuid,student_code text,full_name text,course_id uuid,course_name text,assignment_title text,max_score numeric,
  submitted_at timestamptz,student_note text,submission_link text,score numeric,teacher_feedback text,computed_status public.submission_status,files jsonb
)
language sql stable security definer set search_path=public as $$
  select s.id,p.id,p.student_code,p.full_name,c.id,c.name,a.title,a.max_score,s.submitted_at,s.student_note,s.submission_link,s.score,s.teacher_feedback,
    case when s.submitted_at>a.due_at then 'LATE'::public.submission_status else 'WAITING_REVIEW'::public.submission_status end,
    coalesce((select jsonb_agg(jsonb_build_object('file_name',sf.file_name,'storage_path',sf.storage_path)) from public.submission_files sf where sf.submission_id=s.id),'[]'::jsonb)
  from public.submissions s
  join public.assignments a on a.id=s.assignment_id
  join public.courses c on c.id=a.course_id
  join public.profiles p on p.id=s.student_id
  where a.teacher_id=auth.uid() and s.status in ('WAITING_REVIEW','LATE')
  order by s.submitted_at;
$$;

create or replace function public.student_gradebook(p_student_id uuid)
returns table(assignment_id uuid,assignment_title text,course_name text,max_score numeric,score numeric,teacher_feedback text,computed_status public.submission_status)
language sql stable security definer set search_path=public as $$
  select a.id,a.title,c.name,a.max_score,s.score,s.teacher_feedback,
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
  join public.classroom_students cs on cs.classroom_id=a.classroom_id and cs.student_id=p_student_id
  left join public.submissions s on s.assignment_id=a.id and s.student_id=p_student_id
  where p_student_id=auth.uid()
  order by a.due_at;
$$;

create or replace function public.teacher_dashboard_stats()
returns table(students bigint,assignments bigint,pending bigint,missing bigint)
language sql stable security definer set search_path=public as $$
  select
    (select count(distinct cs.student_id) from public.classrooms cl join public.classroom_students cs on cs.classroom_id=cl.id where cl.teacher_id=auth.uid()),
    (select count(*) from public.assignments a where a.teacher_id=auth.uid()),
    (select count(*) from public.submissions s join public.assignments a on a.id=s.assignment_id where a.teacher_id=auth.uid() and s.status in ('WAITING_REVIEW','LATE')),
    (select count(*) from public.assignments a join public.classroom_students cs on cs.classroom_id=a.classroom_id left join public.submissions s on s.assignment_id=a.id and s.student_id=cs.student_id where a.teacher_id=auth.uid() and now()>a.due_at and s.id is null);
$$;

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_students enable row level security;
alter table public.courses enable row level security;
alter table public.course_classrooms enable row level security;
alter table public.learning_materials enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.announcements enable row level security;

create policy "profiles self" on public.profiles for select using (id=auth.uid());

create policy "student self profile insert v6" on public.profiles
for insert to authenticated
with check (id=auth.uid() and role='student');

create policy "student self profile update v6" on public.profiles
for update to authenticated
using (id=auth.uid() and role='student')
with check (id=auth.uid() and role='student');

create policy "teacher sees enrolled students" on public.profiles for select using (
  exists(select 1 from public.classroom_students cs join public.classrooms cl on cl.id=cs.classroom_id where cs.student_id=profiles.id and cl.teacher_id=auth.uid())
);

create policy "teacher own classrooms" on public.classrooms for all using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "student enrolled classrooms" on public.classrooms for select using (public.student_in_classroom(id,auth.uid()));

create policy "teacher manage memberships" on public.classroom_students for all using (public.teacher_owns_classroom(classroom_id,auth.uid())) with check (public.teacher_owns_classroom(classroom_id,auth.uid()));
create policy "student own membership" on public.classroom_students for select using (student_id=auth.uid());

create policy "teacher own courses" on public.courses for all using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "student enrolled courses" on public.courses for select using (public.student_in_course(id,auth.uid()));

create policy "teacher manage course classrooms" on public.course_classrooms for all using (public.teacher_owns_course(course_id,auth.uid())) with check (public.teacher_owns_course(course_id,auth.uid()) and public.teacher_owns_classroom(classroom_id,auth.uid()));
create policy "student read course classrooms" on public.course_classrooms for select using (public.student_in_classroom(classroom_id,auth.uid()));

create policy "teacher own materials" on public.learning_materials for all using (teacher_id=auth.uid()) with check (teacher_id=auth.uid() and public.teacher_owns_course(course_id,auth.uid()));
create policy "student course materials" on public.learning_materials for select using (public.student_in_course(course_id,auth.uid()));

create policy "teacher own assignments" on public.assignments for all using (teacher_id=auth.uid()) with check (teacher_id=auth.uid() and public.teacher_owns_course(course_id,auth.uid()) and public.teacher_owns_classroom(classroom_id,auth.uid()));
create policy "student own assignments" on public.assignments for select using (public.student_in_classroom(classroom_id,auth.uid()));

create policy "student own submissions" on public.submissions for all using (student_id=auth.uid()) with check (student_id=auth.uid() and exists(select 1 from public.assignments a where a.id=assignment_id and public.student_in_classroom(a.classroom_id,auth.uid())));
create policy "teacher assignment submissions" on public.submissions for all using (exists(select 1 from public.assignments a where a.id=assignment_id and a.teacher_id=auth.uid())) with check (exists(select 1 from public.assignments a where a.id=assignment_id and a.teacher_id=auth.uid()));

create policy "student own submission files read" on public.submission_files for select using (exists(select 1 from public.submissions s where s.id=submission_id and s.student_id=auth.uid()));
create policy "student own submission files insert" on public.submission_files for insert with check (exists(select 1 from public.submissions s where s.id=submission_id and s.student_id=auth.uid()));
create policy "teacher submission files" on public.submission_files for select using (exists(select 1 from public.submissions s join public.assignments a on a.id=s.assignment_id where s.id=submission_id and a.teacher_id=auth.uid()));

create policy "teacher own announcements" on public.announcements for all using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "student relevant announcements" on public.announcements for select using (
  (classroom_id is not null and public.student_in_classroom(classroom_id,auth.uid()))
  or (course_id is not null and public.student_in_course(course_id,auth.uid()))
  or (classroom_id is null and course_id is null)
);

-- ===== STORAGE =====
insert into storage.buckets(id,name,public) values ('submissions','submissions',false) on conflict (id) do update set public=false;
insert into storage.buckets(id,name,public) values ('materials','materials',false) on conflict (id) do update set public=false;

create policy "student upload own submission folder" on storage.objects
for insert to authenticated with check (
  bucket_id='submissions' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "student read own submission files" on storage.objects
for select to authenticated using (
  bucket_id='submissions' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "teacher read own assignment submissions" on storage.objects
for select to authenticated using (
  bucket_id='submissions' and exists(
    select 1 from public.assignments a
    where a.teacher_id=auth.uid() and a.id::text=(storage.foldername(name))[2]
  )
);

create policy "teacher upload own materials" on storage.objects
for insert to authenticated with check (
  bucket_id='materials' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "teacher read own materials" on storage.objects
for select to authenticated using (
  bucket_id='materials' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "student read enrolled materials" on storage.objects
for select to authenticated using (
  bucket_id='materials' and exists(
    select 1 from public.courses c
    where c.id::text=(storage.foldername(name))[2] and public.student_in_course(c.id,auth.uid())
  )
);


-- ============================================================
-- Classroom Hub v7 migration
-- Run ONCE in Supabase SQL Editor AFTER v6.
-- Adds:
--   1) Individual student enrollment per course
--   2) Withdrawal / course completion while keeping history
--   3) Course-wide assignments (classroom optional)
--   4) Student delete-and-resubmit storage permissions
--   5) Teacher assignment deletion storage permissions
-- ============================================================

-- 1) Per-course student enrollment with retained history.
create table if not exists public.course_students (
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  enrolled_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  primary key(course_id,student_id)
);

create index if not exists idx_course_students_student on public.course_students(student_id);
create index if not exists idx_course_students_active on public.course_students(course_id,active);

-- Migrate all existing classroom-based course memberships to the new model.
insert into public.course_students(course_id,student_id,active,enrolled_at)
select distinct cc.course_id,cs.student_id,true,now()
from public.course_classrooms cc
join public.classroom_students cs on cs.classroom_id=cc.classroom_id
on conflict(course_id,student_id) do update
set active=true, withdrawn_at=null;

alter table public.course_students enable row level security;

drop policy if exists "teacher manage course students v7" on public.course_students;
create policy "teacher manage course students v7" on public.course_students
for all to authenticated
using (public.teacher_owns_course(course_id,auth.uid()))
with check (public.teacher_owns_course(course_id,auth.uid()));

drop policy if exists "student read own course enrollment v7" on public.course_students;
create policy "student read own course enrollment v7" on public.course_students
for select to authenticated
using (student_id=auth.uid());

-- Course access now uses individual active enrollment.
create or replace function public.student_in_course(p_course uuid, p_student uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.course_students
    where course_id=p_course and student_id=p_student and active=true
  );
$$;

-- 2) Classroom is now an optional target filter. NULL = all active students in the course.
alter table public.assignments alter column classroom_id drop not null;

create or replace function public.student_can_access_assignment(p_assignment uuid,p_student uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.assignments a
    where a.id=p_assignment
      and public.student_in_course(a.course_id,p_student)
      and (a.classroom_id is null or public.student_in_classroom(a.classroom_id,p_student))
  );
$$;

-- Rebuild assignment policies for optional classroom + course enrollment.
drop policy if exists "teacher own assignments" on public.assignments;
create policy "teacher own assignments" on public.assignments
for all to authenticated
using (teacher_id=auth.uid())
with check (
  teacher_id=auth.uid()
  and public.teacher_owns_course(course_id,auth.uid())
  and (classroom_id is null or public.teacher_owns_classroom(classroom_id,auth.uid()))
);

drop policy if exists "student own assignments" on public.assignments;
create policy "student own assignments" on public.assignments
for select to authenticated
using (
  public.student_in_course(course_id,auth.uid())
  and (classroom_id is null or public.student_in_classroom(classroom_id,auth.uid()))
);

drop policy if exists "student own submissions" on public.submissions;
create policy "student own submissions" on public.submissions
for all to authenticated
using (student_id=auth.uid())
with check (
  student_id=auth.uid()
  and public.student_can_access_assignment(assignment_id,auth.uid())
);

-- 3) Student assignment overview uses active course enrollment.
drop function if exists public.student_assignment_overview(uuid);
create function public.student_assignment_overview(p_student_id uuid)
returns table(
  assignment_id uuid,course_id uuid,title text,course_name text,classroom_name text,due_at timestamptz,
  max_score numeric,submitted_at timestamptz,score numeric,computed_status public.submission_status
)
language sql stable security definer set search_path=public as $$
  select
    a.id,c.id,a.title,c.name,coalesce(cl.name,'ทุกคนในรายวิชา'),a.due_at,a.max_score,s.submitted_at,s.score,
    case
      when s.status='REVISION_REQUIRED' then 'REVISION_REQUIRED'::public.submission_status
      when s.status='GRADED' then 'GRADED'::public.submission_status
      when s.submitted_at is not null and s.submitted_at>a.due_at then 'LATE'::public.submission_status
      when s.submitted_at is not null then 'WAITING_REVIEW'::public.submission_status
      when s.status='IN_PROGRESS' then 'IN_PROGRESS'::public.submission_status
      when now()>a.due_at then 'OVERDUE'::public.submission_status
      else 'NOT_STARTED'::public.submission_status
    end
  from public.assignments a
  join public.courses c on c.id=a.course_id
  join public.course_students ce on ce.course_id=a.course_id and ce.student_id=p_student_id and ce.active=true
  left join public.classrooms cl on cl.id=a.classroom_id
  left join public.submissions s on s.assignment_id=a.id and s.student_id=p_student_id
  where
    (a.classroom_id is null or public.student_in_classroom(a.classroom_id,p_student_id))
    and (p_student_id=auth.uid() or public.is_teacher(auth.uid()))
  order by c.name,a.due_at;
$$;

-- 4) Tracking targets enrolled students, optionally filtered by classroom.
drop function if exists public.teacher_assignment_tracking(uuid);
create function public.teacher_assignment_tracking(p_assignment_id uuid)
returns table(student_id uuid,student_code text,full_name text,submitted_at timestamptz,score numeric,computed_status public.submission_status)
language sql stable security definer set search_path=public as $$
  select p.id,p.student_code,p.full_name,s.submitted_at,s.score,
    case
      when s.status='REVISION_REQUIRED' then 'REVISION_REQUIRED'::public.submission_status
      when s.status='GRADED' then 'GRADED'::public.submission_status
      when s.submitted_at is not null and s.submitted_at>a.due_at then 'LATE'::public.submission_status
      when s.submitted_at is not null then 'WAITING_REVIEW'::public.submission_status
      when s.status='IN_PROGRESS' then 'IN_PROGRESS'::public.submission_status
      when now()>a.due_at then 'OVERDUE'::public.submission_status
      else 'NOT_STARTED'::public.submission_status
    end
  from public.assignments a
  join public.course_students ce on ce.course_id=a.course_id and ce.active=true
  join public.profiles p on p.id=ce.student_id
  left join public.submissions s on s.assignment_id=a.id and s.student_id=p.id
  where a.id=p_assignment_id
    and a.teacher_id=auth.uid()
    and (a.classroom_id is null or public.student_in_classroom(a.classroom_id,p.id))
  order by p.student_code nulls last,p.full_name;
$$;

-- 5) Matrix remains room-based; only active course-enrolled students count.
drop function if exists public.classroom_assignment_matrix(uuid);
create function public.classroom_assignment_matrix(p_classroom_id uuid)
returns table(student_id uuid,full_name text,assignment_id uuid,assignment_title text,computed_status public.submission_status)
language sql stable security definer set search_path=public as $$
  select p.id,p.full_name,a.id,a.title,
    case
      when s.status='REVISION_REQUIRED' then 'REVISION_REQUIRED'::public.submission_status
      when s.status='GRADED' then 'GRADED'::public.submission_status
      when s.submitted_at is not null and s.submitted_at>a.due_at then 'LATE'::public.submission_status
      when s.submitted_at is not null then 'WAITING_REVIEW'::public.submission_status
      when s.status='IN_PROGRESS' then 'IN_PROGRESS'::public.submission_status
      when now()>a.due_at then 'OVERDUE'::public.submission_status
      else 'NOT_STARTED'::public.submission_status
    end
  from public.classroom_students cs
  join public.profiles p on p.id=cs.student_id
  join public.assignments a on (a.classroom_id=p_classroom_id or a.classroom_id is null)
  join public.course_students ce on ce.course_id=a.course_id and ce.student_id=p.id and ce.active=true
  left join public.submissions s on s.assignment_id=a.id and s.student_id=p.id
  where cs.classroom_id=p_classroom_id
    and a.teacher_id=auth.uid()
  order by p.full_name,a.due_at;
$$;

-- 6) Gradebook shows assignments only while actively enrolled.
drop function if exists public.student_gradebook(uuid);
create function public.student_gradebook(p_student_id uuid)
returns table(assignment_id uuid,assignment_title text,course_name text,max_score numeric,score numeric,teacher_feedback text,computed_status public.submission_status)
language sql stable security definer set search_path=public as $$
  select a.id,a.title,c.name,a.max_score,s.score,s.teacher_feedback,
    case
      when s.status='REVISION_REQUIRED' then 'REVISION_REQUIRED'::public.submission_status
      when s.status='GRADED' then 'GRADED'::public.submission_status
      when s.submitted_at is not null and s.submitted_at>a.due_at then 'LATE'::public.submission_status
      when s.submitted_at is not null then 'WAITING_REVIEW'::public.submission_status
      when s.status='IN_PROGRESS' then 'IN_PROGRESS'::public.submission_status
      when now()>a.due_at then 'OVERDUE'::public.submission_status
      else 'NOT_STARTED'::public.submission_status
    end
  from public.assignments a
  join public.courses c on c.id=a.course_id
  join public.course_students ce on ce.course_id=a.course_id and ce.student_id=p_student_id
  left join public.submissions s on s.assignment_id=a.id and s.student_id=p_student_id
  where (a.classroom_id is null or public.student_in_classroom(a.classroom_id,p_student_id))
    and (p_student_id=auth.uid() or public.is_teacher(auth.uid()))
  order by c.name,a.due_at;
$$;

-- 7) Dashboard counts use active course enrollments.
drop function if exists public.teacher_dashboard_stats();
create function public.teacher_dashboard_stats()
returns table(students bigint,assignments bigint,pending bigint,missing bigint)
language sql stable security definer set search_path=public as $$
  select
    (
      select count(distinct ce.student_id)
      from public.course_students ce
      join public.courses c on c.id=ce.course_id
      where c.teacher_id=auth.uid() and ce.active=true
    ),
    (select count(*) from public.assignments a where a.teacher_id=auth.uid()),
    (
      select count(*)
      from public.submissions s
      join public.assignments a on a.id=s.assignment_id
      where a.teacher_id=auth.uid() and s.status in ('WAITING_REVIEW','LATE')
    ),
    (
      select count(*)
      from public.assignments a
      join public.course_students ce on ce.course_id=a.course_id and ce.active=true
      left join public.submissions s on s.assignment_id=a.id and s.student_id=ce.student_id
      where a.teacher_id=auth.uid()
        and now()>a.due_at
        and s.id is null
        and (a.classroom_id is null or public.student_in_classroom(a.classroom_id,ce.student_id))
    );
$$;

-- 8) Course roster RPCs.
create or replace function public.teacher_course_roster(p_course_id uuid)
returns table(student_id uuid,student_code text,full_name text,active boolean,enrolled_at timestamptz,withdrawn_at timestamptz)
language sql stable security definer set search_path=public as $$
  select p.id,p.student_code,p.full_name,ce.active,ce.enrolled_at,ce.withdrawn_at
  from public.course_students ce
  join public.profiles p on p.id=ce.student_id
  where ce.course_id=p_course_id
    and public.teacher_owns_course(p_course_id,auth.uid())
  order by ce.active desc,p.student_code nulls last,p.full_name;
$$;

create or replace function public.teacher_course_available_students(p_course_id uuid)
returns table(student_id uuid,student_code text,full_name text,classroom_names text)
language sql stable security definer set search_path=public as $$
  select
    p.id,p.student_code,p.full_name,
    string_agg(distinct cl.name,', ' order by cl.name)
  from public.profiles p
  join public.classroom_students cs on cs.student_id=p.id
  join public.classrooms cl on cl.id=cs.classroom_id and cl.teacher_id=auth.uid()
  left join public.course_students ce on ce.course_id=p_course_id and ce.student_id=p.id and ce.active=true
  where p.role='student'
    and ce.student_id is null
    and public.teacher_owns_course(p_course_id,auth.uid())
  group by p.id,p.student_code,p.full_name
  order by p.student_code nulls last,p.full_name;
$$;

create or replace function public.teacher_enroll_student_to_course(p_course_id uuid,p_student_code text)
returns text language plpgsql security definer set search_path=public as $$
declare v_student uuid;v_name text;
begin
  if not public.teacher_owns_course(p_course_id,auth.uid()) then
    raise exception 'ไม่มีสิทธิ์จัดการรายวิชานี้';
  end if;

  select distinct p.id,p.full_name into v_student,v_name
  from public.profiles p
  join public.classroom_students cs on cs.student_id=p.id
  join public.classrooms cl on cl.id=cs.classroom_id
  where p.student_code=p_student_code
    and p.role='student'
    and cl.teacher_id=auth.uid()
  limit 1;

  if v_student is null then
    raise exception 'ไม่พบนักเรียนรหัส % ในห้องที่คุณดูแล',p_student_code;
  end if;

  insert into public.course_students(course_id,student_id,active,enrolled_at,withdrawn_at)
  values(p_course_id,v_student,true,now(),null)
  on conflict(course_id,student_id) do update
    set active=true,enrolled_at=now(),withdrawn_at=null;

  return 'เพิ่ม '||v_name||' เข้ารายวิชาแล้ว';
end; $$;

create or replace function public.teacher_enroll_classroom_to_course(p_course_id uuid,p_classroom_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if not public.teacher_owns_course(p_course_id,auth.uid()) or not public.teacher_owns_classroom(p_classroom_id,auth.uid()) then
    raise exception 'ไม่มีสิทธิ์จัดการข้อมูลนี้';
  end if;

  insert into public.course_students(course_id,student_id,active,enrolled_at,withdrawn_at)
  select p_course_id,cs.student_id,true,now(),null
  from public.classroom_students cs
  where cs.classroom_id=p_classroom_id
  on conflict(course_id,student_id) do update
    set active=true,enrolled_at=now(),withdrawn_at=null;

  get diagnostics v_count=row_count;
  return v_count;
end; $$;

create or replace function public.teacher_withdraw_student_from_course(p_course_id uuid,p_student_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.teacher_owns_course(p_course_id,auth.uid()) then
    raise exception 'ไม่มีสิทธิ์จัดการรายวิชานี้';
  end if;
  update public.course_students
  set active=false,withdrawn_at=now()
  where course_id=p_course_id and student_id=p_student_id;
end; $$;

create or replace function public.teacher_complete_course(p_course_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if not public.teacher_owns_course(p_course_id,auth.uid()) then
    raise exception 'ไม่มีสิทธิ์จัดการรายวิชานี้';
  end if;
  update public.course_students
  set active=false,withdrawn_at=now()
  where course_id=p_course_id and active=true;
  get diagnostics v_count=row_count;
  return v_count;
end; $$;

-- 9) Profile visibility: teacher may see students currently or historically in their courses.
drop policy if exists "teacher sees enrolled students v7" on public.profiles;
create policy "teacher sees enrolled students v7" on public.profiles
for select to authenticated using (
  exists(
    select 1
    from public.course_students ce
    join public.courses c on c.id=ce.course_id
    where ce.student_id=profiles.id and c.teacher_id=auth.uid()
  )
);

-- Existing classroom-based visibility policy remains too, so teachers can find students before course enrollment.

-- 10) Student can delete submission file metadata belonging to own submission.
drop policy if exists "student own submission files delete v7" on public.submission_files;
create policy "student own submission files delete v7" on public.submission_files
for delete to authenticated
using (
  exists(select 1 from public.submissions s where s.id=submission_id and s.student_id=auth.uid())
);

drop policy if exists "teacher submission files delete v7" on public.submission_files;
create policy "teacher submission files delete v7" on public.submission_files
for delete to authenticated
using (
  exists(
    select 1 from public.submissions s
    join public.assignments a on a.id=s.assignment_id
    where s.id=submission_id and a.teacher_id=auth.uid()
  )
);

-- 11) Storage delete permissions for re-submit and assignment deletion.
drop policy if exists "student delete own submission files v7" on storage.objects;
create policy "student delete own submission files v7" on storage.objects
for delete to authenticated using (
  bucket_id='submissions'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "teacher delete own assignment submissions v7" on storage.objects;
create policy "teacher delete own assignment submissions v7" on storage.objects
for delete to authenticated using (
  bucket_id='submissions'
  and exists(
    select 1 from public.assignments a
    where a.teacher_id=auth.uid()
      and a.id::text=(storage.foldername(name))[2]
  )
);

-- 12) Materials access automatically follows active course enrollment via student_in_course().
