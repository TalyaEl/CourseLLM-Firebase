-- SQL schema for Intent-Skill-Trajectory events table
-- Run this in your Supabase SQL editor to create the table
-- 
-- Note: This is a reference schema. The application does not execute this SQL automatically.

create table if not exists intent_skill_trajectory_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  user_id text,
  course_id text,
  utterance text not null,
  course_context text,
  intent text not null,
  skills jsonb not null,
  trajectory jsonb not null
);

-- Optional: Create an index on created_at for faster time-based queries
-- create index if not exists idx_ist_events_created_at on intent_skill_trajectory_events(created_at);

-- Optional: Create an index on user_id for faster user-based queries
-- create index if not exists idx_ist_events_user_id on intent_skill_trajectory_events(user_id);

-- Optional: Create an index on course_id for faster course-based queries
-- create index if not exists idx_ist_events_course_id on intent_skill_trajectory_events(course_id);

