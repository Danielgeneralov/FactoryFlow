# Supabase Row-Level Security (RLS) Setup Instructions

## Issue: "Failed to save quote: new row violates row-level security policy for table 'jobs'"

This error occurs because Supabase has Row-Level Security (RLS) enabled on your database tables by default, but no policies have been created to allow the anonymous role to insert data.

## How to Fix It

1. **Log in to your Supabase Dashboard**: https://app.supabase.com/

2. **Navigate to your project**

3. **Go to the Table Editor**:
   - In the left sidebar, click on "Table Editor"
   - Select the "jobs" table

4. **Add Policies**:
   - Click on "Policies" tab at the top
   - Click "Add Policy" button

5. **Create INSERT Policy**:
   - Select "INSERT" as the type
   - Name it "Allow anon insert"
   - Set the USING expression to: `true`
   - Set the WITH CHECK expression to: `true`
   - Make sure the target roles includes "anon" or "authenticated"
   - Click "Save Policy"

6. **Create SELECT Policy**:
   - Click "Add Policy" button again
   - Select "SELECT" as the type
   - Name it "Allow anon select"
   - Set the USING expression to: `true`
   - Make sure the target roles includes "anon" or "authenticated"
   - Click "Save Policy"

7. **Test Your Application**:
   - After adding both policies, try submitting a quote again
   - The data should now be saved to Supabase instead of localStorage

## Alternative: Using SQL

If you prefer, you can run the following SQL commands in the SQL Editor of your Supabase project:

```sql
-- Create policies for the jobs table
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts
CREATE POLICY "Allow anon insert" ON public.jobs
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous selects
CREATE POLICY "Allow anon select" ON public.jobs
  FOR SELECT TO anon
  USING (true);
```

## Security Note

This configuration allows any anonymous user to insert and read all records in the jobs table. In a production environment, you might want to implement more restrictive policies based on user authentication or other conditions. For a simple MVP, the above configuration should work fine. 