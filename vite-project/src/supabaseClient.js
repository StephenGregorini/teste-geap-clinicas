import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://khgzapvzpropersfzenq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoZ3phcHZ6cHJvcGVyc2Z6ZW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODk1ODIsImV4cCI6MjA4MDM2NTU4Mn0.3xT4c6UPWtrukYRyJI9Henj4YenYj_5kgDTuv93Ti1E"
);
