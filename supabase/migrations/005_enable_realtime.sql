-- Enable Realtime for tables used by live subscriptions
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table conversation_members;
