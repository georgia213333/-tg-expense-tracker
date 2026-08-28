create table expenses (
  id bigint generated always as identity primary key,
  telegram_user_id bigint not null,
  amount numeric not null,
  currency text not null,
  category text not null,
  date date not null,
  note text,
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

-- Пилотная политика: открыта для всех запросов с anon-ключом.
-- Клиент сам фильтрует по telegram_user_id, но это не защита от подмены ID.
-- До открытия на реальных других пользователей — заменить на политику
-- по проверенному JWT с telegram_user_id вместо этой.
create policy "pilot_open_access"
on expenses
for all
using (true)
with check (true);
