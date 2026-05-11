alter table if exists orders
  add column if not exists original_text text;

update orders
set original_text = coalesce(original_text, original_message)
where original_text is null;

update orders
set original_message = coalesce(original_message, original_text)
where original_message is null;

alter table if exists orders
  alter column original_text set not null;
