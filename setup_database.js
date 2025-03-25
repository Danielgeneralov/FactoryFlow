// This script will help create the jobs table in your Supabase database
// Run with: node setup_database.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cpnbybkgniwshqavvnlz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwbmJ5Ymtnbml3c2hxYXZ2bmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4NDg3MDEsImV4cCI6MjA1ODQyNDcwMX0.OXARQAInCNo8IX7qF2OjqABzDws6csfr8q4JzSZL6ec';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupJobsTable() {
  console.log('Checking for jobs table...');
  
  // Try to query the jobs table
  const { error: checkError } = await supabase
    .from('jobs')
    .select('id')
    .limit(1);
  
  if (!checkError) {
    console.log('✅ Jobs table already exists');
    
    // Fix RLS policies if the table exists
    console.log('🔄 Ensuring RLS policies are correctly set...');
    
    const { error: rlsError } = await supabase.rpc('run_sql', {
      sql: `
        -- Ensure RLS is enabled
        ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if any
        DROP POLICY IF EXISTS "Allow anon insert" ON public.jobs;
        DROP POLICY IF EXISTS "Allow anon select" ON public.jobs;
        
        -- Create policies that actually work for anon role
        CREATE POLICY "Allow anon insert" ON public.jobs
          FOR INSERT TO anon WITH CHECK (true);
          
        CREATE POLICY "Allow anon select" ON public.jobs
          FOR SELECT TO anon USING (true);
      `
    });
    
    if (rlsError) {
      console.error('❌ Error fixing RLS policies:', rlsError.message);
      console.log('Please fix the RLS policies manually in the Supabase dashboard');
    } else {
      console.log('✅ RLS policies updated successfully');
    }
    
    return;
  }
  
  if (checkError.code !== '42P01') {
    console.error('❌ Error checking jobs table:', checkError.message);
    return;
  }
  
  console.log('🔄 Jobs table does not exist. Creating it via SQL query...');
  
  // Create the table using SQL
  // Note: This will only work if your API key has create table permissions
  // If not, you'll need to create this table in the Supabase dashboard
  const { error: createError } = await supabase.rpc('run_sql', {
    sql: `
      CREATE TABLE public.jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        part_type TEXT NOT NULL,
        material TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        complexity TEXT NOT NULL,
        deadline TEXT,
        quote NUMERIC(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Set up table security policies
      ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for anonymous access
      CREATE POLICY "Allow anon insert" ON public.jobs
        FOR INSERT TO anon WITH CHECK (true);
        
      CREATE POLICY "Allow anon select" ON public.jobs
        FOR SELECT TO anon USING (true);
    `
  });
  
  if (createError) {
    console.error('❌ Error creating jobs table via SQL:', createError.message);
    console.log('Please create the table manually in the Supabase dashboard with the following structure:');
    console.log(`
      CREATE TABLE public.jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        part_type TEXT NOT NULL,
        material TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        complexity TEXT NOT NULL,
        deadline TEXT,
        quote NUMERIC(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Then add these RLS policies:
      ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Allow anon insert" ON public.jobs
        FOR INSERT TO anon WITH CHECK (true);
        
      CREATE POLICY "Allow anon select" ON public.jobs
        FOR SELECT TO anon USING (true);
    `);
    return;
  }
  
  console.log('✅ Successfully created jobs table with proper RLS policies');
}

// Run the setup function
setupJobsTable()
  .catch(err => {
    console.error('❌ Error running setup:', err.message);
  })
  .finally(() => {
    console.log('Setup process completed');
  }); 