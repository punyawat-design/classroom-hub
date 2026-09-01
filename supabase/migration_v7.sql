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
