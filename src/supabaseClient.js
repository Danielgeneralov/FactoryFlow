import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cpnbybkgniwshqavvnlz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwbmJ5Ymtnbml3c2hxYXZ2bmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4NDg3MDEsImV4cCI6MjA1ODQyNDcwMX0.OXARQAInCNo8IX7qF2OjqABzDws6csfr8q4JzSZL6ec'

// Create client with custom settings
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-application-name': 'factoryflow-mvp',
    },
  },
})

// Helper to check if Supabase is available
export const checkSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    
    // Try a simple query to the jobs table directly
    // eslint-disable-next-line no-unused-vars
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select('id')
      .limit(1);
    
    if (!jobsError) {
      console.log('Successfully connected to Supabase and jobs table exists');
      return { isConnected: true, error: null };
    }
    
    // If that failed due to table not existing, we're still connected but need to create table
    if (jobsError && jobsError.code === '42P01') {
      console.log('Connected to Supabase but jobs table does not exist');
      return { isConnected: true, error: jobsError };
    }
    
    // Try system tables as a fallback
    console.log('Jobs table check failed, trying system tables:', jobsError);
    // eslint-disable-next-line no-unused-vars
    const { data, error } = await supabase.from('pg_catalog.pg_tables').select('schemaname').limit(1);
    
    if (error && (error.code === '42501' || error.message.includes('permission denied'))) {
      console.log('Connected to Supabase (permission error on system tables, but connection successful)');
      return { isConnected: true, error: null };
    }
    
    if (error) {
      console.error('Supabase connection error on system tables:', error);
      return { isConnected: false, error };
    }
    
    console.log('Connected to Supabase via system tables');
    return { isConnected: true, error: null };
  } catch (err) {
    console.error('Supabase connection error:', err);
    return { isConnected: false, error: err };
  }
};

// Function to create the jobs table if it doesn't exist
export const createJobsTable = async () => {
  try {
    // First check if table exists by trying to query it
    const { error: checkError } = await supabase.from('jobs').select('count(*)', { count: 'exact' }).limit(0);
    
    // If error indicates table doesn't exist, create it
    if (checkError && checkError.code === '42P01') { // PostgreSQL error code for undefined_table
      console.log('Jobs table does not exist, attempting to verify it exists in Supabase dashboard...');
      
      // Just return - user needs to manually create the table in the dashboard
      console.log('Please ensure the jobs table exists in your Supabase dashboard with these columns:');
      console.log('- id: UUID (primary key with default uuid_generate_v4())');
      console.log('- part_type: TEXT (not null)');
      console.log('- material: TEXT (not null)');
      console.log('- quantity: INTEGER (not null)');
      console.log('- complexity: TEXT (not null)');
      console.log('- deadline: TEXT');
      console.log('- quote: NUMERIC(10,2)');
      console.log('- rush_fee_enabled: BOOLEAN (default: false)');
      console.log('- rush_fee_amount: NUMERIC(10,2) (default: 0)');
      console.log('- margin_percentage: INTEGER (default: 20)');
      console.log('- created_at: TIMESTAMP WITH TIME ZONE (default: NOW())');
      
      return { success: false, error: checkError, needsManualTableCreation: true };
    }
    
    if (checkError) {
      console.error('Error checking jobs table:', checkError);
      return { success: false, error: checkError };
    }
    
    console.log('Jobs table already exists');
    return { success: true, error: null };
  } catch (err) {
    console.error('Error creating jobs table:', err);
    return { success: false, error: err };
  }
};

// Helper to handle database operations with localStorage fallback
export const db = {
  // Insert with localStorage fallback
  async insert(table, data, options = {}) {
    try {
      // Check connection first
      console.log(`Attempting to insert into ${table}:`, data);
      const { isConnected, error: connError } = await checkSupabaseConnection();
      console.log('Connection status:', isConnected, connError);
      
      // If not connected, use localStorage
      if (!isConnected) {
        console.log('Not connected to Supabase, using localStorage');
        return this._saveToLocalStorage(table, data);
      }
      
      // Try Supabase insert
      console.log('Attempting Supabase insert...');
      const { data: result, error } = await supabase
        .from(table)
        .insert([data])
        .select();
        
      if (error) {
        console.error(`Error inserting into ${table}:`, error);
        
        // Handle common errors
        if (error.code === '42P01') { // Table doesn't exist
          console.error(`Table "${table}" does not exist - please create it in Supabase dashboard`);
          return this._saveToLocalStorage(table, data, 
            'Table does not exist in database. Using local storage until fixed.');
        }
        
        if (error.code === '42703') { // Column doesn't exist
          console.error(`Column mismatch in table "${table}" - check your table structure`);
          
          // Check for specific column error messages
          if (error.message && error.message.includes('margin_percentage')) {
            console.error('Missing margin_percentage column. Please add this column to your jobs table.');
            console.log('You need to run this SQL in your Supabase SQL editor:');
            console.log('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS margin_percentage INTEGER DEFAULT 20;');
          }
          
          if (error.message && error.message.includes('rush_fee_enabled')) {
            console.error('Missing rush_fee_enabled column. Please add this column to your jobs table.');
            console.log('You need to run this SQL in your Supabase SQL editor:');
            console.log('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rush_fee_enabled BOOLEAN DEFAULT FALSE;');
          }
          
          if (error.message && error.message.includes('rush_fee_amount')) {
            console.error('Missing rush_fee_amount column. Please add this column to your jobs table.');
            console.log('You need to run this SQL in your Supabase SQL editor:');
            console.log('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rush_fee_amount DECIMAL(10,2) DEFAULT 0;');
          }
          
          return this._saveToLocalStorage(table, data, 
            'Table columns don\'t match the data. Using local storage until fixed.');
        }
        
        // RLS policy violation
        if (error.code === '42501' || error.message.includes('row-level security') || error.message.includes('violates row-level security policy')) {
          console.error(`RLS policy violation for table "${table}" - need to fix permissions in Supabase dashboard`);
          const instructions = `
            Please go to your Supabase dashboard > Table Editor > jobs > Policies and add these policies:
            1. FOR INSERT - Allow anon role - WITH CHECK (true)
            2. FOR SELECT - Allow anon role - USING (true)
          `;
          console.log(instructions);
          
          // Graceful fallback to localStorage with helpful message
          return this._saveToLocalStorage(table, data, 
            'Row-level security blocked the insert. Using local storage until fixed in Supabase dashboard.');
        }
        
        return { data: null, error, demoMode: false };
      }
      
      console.log(`Successfully inserted data into ${table}:`, result);
      return { data: result, error: null, demoMode: false };
    } catch (err) {
      console.error(`Exception inserting into ${table}:`, err);
      return this._saveToLocalStorage(table, data);
    }
  },
  
  // Internal helper for localStorage fallback
  _saveToLocalStorage(table, data, message = 'Saved to local storage in demo mode') {
    try {
      const storageKey = table;
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      // Add an ID and timestamp if not present
      const newItem = { 
        ...data, 
        id: data.id || Date.now(),
        created_at: data.created_at || new Date().toISOString()
      };
      
      // Add to array and save
      existing.push(newItem);
      localStorage.setItem(storageKey, JSON.stringify(existing));
      
      return { 
        data: [newItem], 
        error: null, 
        demoMode: true,
        message
      };
    } catch (e) {
      console.error('Error saving to localStorage:', e);
      return { 
        data: null, 
        error: { message: 'Failed to save data even in fallback mode' },
        demoMode: true
      };
    }
  }
};
