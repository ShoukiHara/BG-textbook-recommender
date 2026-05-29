-- grade 列を enrollment_year 列に置き換え
alter table instructors drop column if exists grade;
alter table instructors add column if not exists enrollment_year text not null default '';
