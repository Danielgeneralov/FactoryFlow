import React, { useState, useEffect, useRef } from 'react';
// Import AOS from CDN instead of node_modules to avoid potential issues
// AOS CSS and JS are already loaded in index.html
import { supabase, checkSupabaseConnection, createJobsTable, db } from './supabaseClient';
import axios from 'axios';

// Enhanced App with better UI and AOS animations
function App() {
  console.log('App component is rendering');
  
  // State for the form fields
  const [formData, setFormData] = useState({
    partType: '',
    material: 'steel',
    quantity: '',
    complexity: 'medium',
    deadline: ''
  });
  
  // State for UI
  const [quote, setQuote] = useState(null);
  const [errors, setErrors] = useState({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ type: null, message: null });
  const [demoMode, setDemoMode] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState([]);
  // Add state for storing jobs from Supabase
  const [jobs, setJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState(null);
  // Add state for tracking window width
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // State for AI quote suggestion
  const [isAiQuoting, setIsAiQuoting] = useState(false);
  const [aiQuoteResult, setAiQuoteResult] = useState(null);
  const [aiQuoteError, setAiQuoteError] = useState(null);
  
  // Default material prices
  const defaultMaterialPrices = {
    'aluminum': 10,
    'steel': 15,
    'plastic': 5,
    'titanium': 50
  };
  
  // State for customized material prices
  const [materialPrices, setMaterialPrices] = useState(defaultMaterialPrices);
  
  // State to track if prices are customized
  const [pricesCustomized, setPricesCustomized] = useState(false);
  
  // State for collapsible material price customization section
  const [showMaterialPrices, setShowMaterialPrices] = useState(false);
  
  // State for price calculation details
  const [priceDetails, setPriceDetails] = useState(null);
  
  // State for showing price tooltip
  const [showPriceTooltip, setShowPriceTooltip] = useState(false);
  
  // State for advanced options
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [rushFeeEnabled, setRushFeeEnabled] = useState(false);
  const [rushFeeAmount, setRushFeeAmount] = useState(50); // Flat fee in dollars
  const [marginPercentage, setMarginPercentage] = useState(20); // Default 20% margin
  
  // References for sections
  const quoteResultRef = useRef(null);
  const quoteFormRef = useRef(null);
  
  useEffect(() => {
    console.log('App component mounted');
    
    // Initialize the database structure if needed
    const initializeDatabase = async () => {
      console.log('Checking database structure...');
      try {
        // Test connection first
        const { isConnected } = await checkSupabaseConnection();
        if (!isConnected) {
          console.error('Connection to Supabase failed');
          setDemoMode(true);
          return;
        }
        
        // Try to get schema version or similar metadata
        const { error } = await supabase
          .from('jobs')
          .select('id')
          .limit(1);
          
        if (error) {
          if (error.code === '42P01') { // Table doesn't exist error code
            console.log('Jobs table does not exist. Creating table with SQL...');
            
            // Create the jobs table directly with SQL
            const { error: sqlError } = await supabase.rpc('exec', {
              query: `
                CREATE TABLE IF NOT EXISTS jobs (
                  id SERIAL PRIMARY KEY,
                  part_type TEXT NOT NULL,
                  material TEXT NOT NULL,
                  quantity INTEGER NOT NULL,
                  complexity TEXT NOT NULL,
                  deadline DATE,
                  quote_amount DECIMAL(10,2) NOT NULL,
                  rush_fee_enabled BOOLEAN DEFAULT FALSE,
                  rush_fee_amount DECIMAL(10,2) DEFAULT 0,
                  margin_percentage INTEGER DEFAULT 20,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
              `
            });
            
            if (sqlError) {
              console.error('Failed to create jobs table:', sqlError);
              setDemoMode(true);
            } else {
              console.log('Jobs table created successfully');
              setDemoMode(false);
            }
          } else {
            console.error('Error checking jobs table:', error);
          }
        } else {
          console.log('Jobs table exists and is accessible');
          setDemoMode(false);
        }
      } catch (err) {
        console.error('Error initializing database:', err);
        setDemoMode(true);
      }
    };

    initializeDatabase();
    
    // Use global AOS initialized in index.html
    if (window.AOS) {
      window.AOS.refresh();
    }
    
    // Re-initialize on window resize for responsiveness
    const handleResize = () => {
      if (window.AOS) {
        window.AOS.refresh();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      console.log('App component unmounted');
    };
  }, []);
  
  // Update window width when resized
  useEffect(() => {
    const handleWindowResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleWindowResize);
    
    // Cleanup resize listener
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);
  
  // Load saved material prices from localStorage
  useEffect(() => {
    try {
      // Load material prices
      const savedPrices = localStorage.getItem('materialPrices');
      if (savedPrices) {
        const parsedPrices = JSON.parse(savedPrices);
        setMaterialPrices(parsedPrices);
        
        // Check if prices are different from defaults
        const isCustomized = Object.keys(parsedPrices).some(
          material => parsedPrices[material] !== defaultMaterialPrices[material]
        );
        setPricesCustomized(isCustomized);
      }
      
      // Load advanced options
      const savedAdvancedOptions = localStorage.getItem('advancedOptions');
      if (savedAdvancedOptions) {
        const parsedOptions = JSON.parse(savedAdvancedOptions);
        if (parsedOptions.rushFeeEnabled !== undefined) {
          setRushFeeEnabled(parsedOptions.rushFeeEnabled);
        }
        if (parsedOptions.rushFeeAmount) {
          setRushFeeAmount(parsedOptions.rushFeeAmount);
        }
        if (parsedOptions.marginPercentage) {
          setMarginPercentage(parsedOptions.marginPercentage);
        }
      }
    } catch (err) {
      console.error('Error loading saved settings:', err);
    }
  }, [defaultMaterialPrices]);
  
  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Handle form reset
  const resetForm = () => {
    setFormData({
      partType: '',
      material: 'steel',
      quantity: '',
      complexity: 'medium',
      deadline: ''
    });
    setQuote(null);
    setErrors({});
    setSubmitStatus({ type: null, message: null });
    
    // Reset AI quote state
    setAiQuoteResult(null);
    setAiQuoteError(null);
    setIsAiQuoting(false);
  };
  
  // Calculate the quote and prepare job data for Supabase insertion
  const calculateQuote = async (e) => {
    e.preventDefault();
    
    console.log('Form data:', formData);
    
    // Validate form data
    const validationErrors = {};
    if (!formData.partType.trim()) validationErrors.partType = 'Part type is required';
    if (!formData.material) validationErrors.material = 'Material is required';
    if (!formData.quantity || isNaN(parseInt(formData.quantity)) || parseInt(formData.quantity) <= 0) {
      validationErrors.quantity = 'Valid quantity is required';
    }
    
    console.log('Validation errors:', validationErrors);
    
    // If there are errors, update the errors state and show an error message
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitStatus({
        type: 'error',
        message: 'Please fill in all required fields correctly.'
      });
      return;
    }
    
    // Clear any previous errors
    setErrors({});
    setIsCalculating(true);
    
    // Use setTimeout to simulate calculation time for better UX
    setTimeout(async () => {
      // Complexity multipliers
      const complexityMultipliers = {
        'simple': 1.0,
        'medium': 1.5,
        'complex': 2.5
      };
      
      // Use custom material prices from state
      const basePrice = materialPrices[formData.material] || 10;
      const complexityMultiplier = complexityMultipliers[formData.complexity] || 1.5;
      const quantityMultiplier = Math.max(1, Math.log10(parseInt(formData.quantity)) + 1);
      
      // Calculate base cost
      const baseCost = basePrice * complexityMultiplier * quantityMultiplier * parseInt(formData.quantity);
      
      // Calculate final quote amount with some randomness for demo effect
      const randomFactor = 0.9 + (Math.random() * 0.2); // Random factor between 0.9 and 1.1
      let calculatedAmount = baseCost * randomFactor;
      
      // Apply margin
      const marginMultiplier = 1 + (marginPercentage / 100);
      calculatedAmount = calculatedAmount * marginMultiplier;
      
      // Add rush fee if enabled
      let rushFee = 0;
      if (rushFeeEnabled) {
        rushFee = rushFeeAmount;
        calculatedAmount += rushFee;
      }
      
      const finalQuote = parseFloat(calculatedAmount.toFixed(2));
      
      // Prepare job data for Supabase insertion
      const jobData = {
        part_type: formData.partType,
        material: formData.material,
        quantity: parseInt(formData.quantity),
        complexity: formData.complexity,
        deadline: formData.deadline || null,
        quote: finalQuote,
        created_at: new Date().toISOString(),
        // Store advanced options in job data for reference
        rush_fee_enabled: rushFeeEnabled,
        rush_fee_amount: rushFeeEnabled ? rushFeeAmount : 0,
        margin_percentage: marginPercentage
      };
      
      // Store price calculation details for the tooltip
      const details = { 
        material: formData.material,
        basePrice: basePrice.toFixed(2),
        complexity: formData.complexity,
        complexityMultiplier: complexityMultiplier.toFixed(2),
        quantity: parseInt(formData.quantity),
        quantityMultiplier: quantityMultiplier.toFixed(2),
        randomFactor: randomFactor.toFixed(2),
        marginPercentage: marginPercentage,
        marginMultiplier: marginMultiplier.toFixed(2),
        rushFeeEnabled: rushFeeEnabled,
        rushFeeAmount: rushFee.toFixed(2),
        baseCost: baseCost.toFixed(2),
        finalQuote: finalQuote.toFixed(2)
      };
      
      // Log the price calculation details
      console.log('Price calculation:', details);
      
      // Update state with price details
      setPriceDetails(details);
      
      // Update local state
      setQuote(finalQuote);
      
      // Insert job data to Supabase with fallback
      console.log('Calling insertJobToSupabase with data:', jobData);
      const result = await insertJobToSupabase(jobData);
      console.log('Insert result:', result);
      
      if (result.success) {
        setSubmitStatus({
          type: 'success',
          message: result.message || 'Quote saved successfully!'
        });
      } else {
        setSubmitStatus({
          type: 'error',
          message: result.message || 'Failed to save quote.'
        });
      }
      
      setIsCalculating(false);
      
      // Scroll to result with animation
      setTimeout(() => {
        if (quoteResultRef.current) {
          quoteResultRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
        
        // Refresh AOS for animations
        if (window.AOS) {
          window.AOS.refresh();
        }
      }, 100);
    }, 1500); // Simulate calculation time for better UX
  };
  
  // Insert job data into Supabase with improved error handling and fallback
  const insertJobToSupabase = async (jobData) => {
    console.log('Attempting to insert job data:', jobData);
    
    try {
      // eslint-disable-next-line no-unused-vars
      const { data, error, demoMode: isDemo, message } = await db.insert('jobs', jobData);
      
      if (error) {
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // Check for column mismatch error
        if (error.code === '42703') {
          console.error('Column mismatch detected - you need to update your database schema manually');
          
          // Show instructions for manual schema update
          if (error.message && error.message.includes('margin_percentage')) {
            console.log('SQL to add missing margin_percentage column:');
            console.log('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS margin_percentage INTEGER DEFAULT 20;');
          }
          
          if (error.message && error.message.includes('rush_fee_enabled')) {
            console.log('SQL to add missing rush_fee_enabled column:');
            console.log('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rush_fee_enabled BOOLEAN DEFAULT FALSE;');
          }
          
          if (error.message && error.message.includes('rush_fee_amount')) {
            console.log('SQL to add missing rush_fee_amount column:');
            console.log('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rush_fee_amount DECIMAL(10,2) DEFAULT 0;');
          }
          
          setSubmitStatus({
            type: 'error',
            message: 'Missing database columns. Please update your database schema manually. Check the console for instructions.'
          });
          
          // Fall back to localStorage
          setDemoMode(true);
          const updatedSavedQuotes = [...savedQuotes, jobData];
          setSavedQuotes(updatedSavedQuotes);
          
          return {
            success: true,
            message: 'Quote saved locally (database schema needs manual update)'
          };
        }
        
        // Check for RLS policy error
        if (error.message && (error.message.includes('row-level security') || error.message.includes('violates row-level security policy'))) {
          console.error('RLS policy error detected:', error.message);
          setSubmitStatus({
            type: 'error',
            message: 'Row-level security policy error. Please check the RLS policies in your Supabase dashboard for the jobs table.'
          });
          
          // Show more helpful instructions in the console
          console.log('To fix this error, go to your Supabase dashboard > Table Editor > jobs > Policies');
          console.log('Then add the following policies:');
          console.log('1. FOR INSERT - Allow anon role - WITH CHECK (true)');
          console.log('2. FOR SELECT - Allow anon role - USING (true)');
          
          // Still use localStorage as fallback
          setDemoMode(true);
          // In demo mode, add to saved quotes for display
          const updatedSavedQuotes = [...savedQuotes, jobData];
          setSavedQuotes(updatedSavedQuotes);
          
          return {
            success: true,
            message: 'Quote saved locally (database access restricted)'
          };
        }
        
        setSubmitStatus({
          type: 'error',
          message: `Failed to save quote: ${error.message || 'Please try again.'}`
        });
        return {
          success: false,
          message: `Failed to save quote: ${error.message || 'Please try again.'}`
        };
      }

      if (isDemo) {
        setDemoMode(true);
        // In demo mode, add to saved quotes for display
        const updatedSavedQuotes = [...savedQuotes, jobData];
        setSavedQuotes(updatedSavedQuotes);
        
        // If we got a specific message about the fallback reason, display it
        if (message) {
          console.log('Fallback message:', message);
          setSubmitStatus({
            type: 'warning',
            message: message
          });
          return {
            success: true,
            message: message
          };
        }
        
        console.log('Quote saved in demo mode');
      } else {
        // Explicitly set demo mode to false on successful database insert
        setDemoMode(false);
        
        // Refresh the jobs list if we successfully saved to Supabase
        setTimeout(() => {
          fetchJobs();
        }, 500); // Small delay to allow the database to update
      }

      setSubmitStatus({
        type: 'success',
        message: 'Quote saved successfully!'
      });
      return {
        success: true,
        message: 'Quote saved successfully!'
      };
    } catch (err) {
      console.error('Exception details:', JSON.stringify(err, null, 2));
      setDemoMode(true);
      setSubmitStatus({
        type: 'error',
        message: `Error saving quote: ${err.message || 'Please try again.'}`
      });
      return {
        success: false,
        message: `Error saving quote: ${err.message || 'Please try again.'}`
      };
    }
  };
  
  // Function to alter the jobs table and add missing columns
  // eslint-disable-next-line no-unused-vars
  const alterJobsTable = async () => {
    // This function is being removed as requested
    return { success: false, error: { message: 'Schema updates must be done manually'} };
  };
  
  // After insertJobToSupabase sets demoMode, render info banner
  const DemoModeBanner = () => {
    if (!demoMode) return null;
    
    return (
      <div className="demo-mode-banner" style={{
        backgroundColor: '#fff8e1',
        border: '1px solid #ffd54f',
        borderRadius: '4px',
        padding: '8px 12px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.9rem'
      }}>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          width="20" 
          height="20" 
          style={{ marginRight: '8px', fill: '#ff9800' }}
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>
          Running in demo mode - quotes are stored locally in your browser
        </span>
      </div>
    );
  };
  
  // Component to show saved quotes in demo mode
  const SavedQuotes = () => {
    const [showQuotes, setShowQuotes] = useState(false);
    
    // Load quotes when component mounts or demo mode changes
    useEffect(() => {
      if (demoMode) {
        console.log('SavedQuotes: Loading quotes in demo mode');
        try {
          const storedQuotes = JSON.parse(localStorage.getItem('jobs') || '[]');
          console.log('Loaded quotes from localStorage:', storedQuotes);
          setSavedQuotes(storedQuotes);
        } catch (err) {
          console.error('Error loading saved quotes:', err);
          setSavedQuotes([]);
        }
      }
    }, [demoMode]); // eslint-disable-line react-hooks/exhaustive-deps
    
    console.log('SavedQuotes rendering with:', { demoMode, quotesCount: savedQuotes.length, showQuotes });
    
    // Don't show component if not in demo mode or no quotes
    if (!demoMode) {
      console.log('Not in demo mode, not showing saved quotes');
      return null;
    }
    
    if (savedQuotes.length === 0) {
      console.log('No saved quotes to display');
      return (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          textAlign: 'center',
          color: '#666'
        }}>
          No saved quotes yet
        </div>
      );
    }
    
    return (
      <div className="saved-quotes" style={{
        marginTop: '24px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: showQuotes ? '16px' : '0'
        }}>
          <h3 style={{ margin: '0', fontSize: '1.1rem' }}>Saved Quotes ({savedQuotes.length})</h3>
          <button 
            onClick={() => {
              console.log('Toggle show quotes:', !showQuotes);
              setShowQuotes(!showQuotes);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#2196f3',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {showQuotes ? 'Hide' : 'Show'}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              style={{ 
                marginLeft: '4px',
                transform: showQuotes ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s'
              }}
              fill="#2196f3"
            >
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
        </div>
        
        {showQuotes && (
          <div className="quotes-list" style={{ marginTop: '8px' }}>
            {savedQuotes.map((job, index) => (
              <div 
                key={job.id || index} 
                style={{
                  padding: '12px',
                  borderBottom: index < savedQuotes.length - 1 ? '1px solid #e0e0e0' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '500' }}>
                    {job.quantity} × {job.part_type} ({job.material})
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>
                    {job.complexity} complexity
                    {job.deadline && ` • Due by ${new Date(job.deadline).toLocaleDateString()}`}
                  </div>
                </div>
                <div style={{ 
                  fontWeight: 'bold', 
                  fontSize: '1.1rem',
                  color: '#4caf50'
                }}>
                  ${parseFloat(job.quote || job.quote_amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // Component to display jobs from Supabase
  const JobList = () => {
    // Don't show if in demo mode
    if (demoMode) {
      return null;
    }

    return (
      <div className="job-list" style={{
        marginTop: '40px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ 
            margin: '0', 
            fontSize: '1.2rem',
            color: '#1e293b',
            fontWeight: '600' 
          }}>
            Your Jobs History ({jobs.length})
          </h3>

          <button
            onClick={fetchJobs}
            disabled={isLoadingJobs}
            onMouseEnter={(e) => handleButtonHover(e, true)}
            onMouseLeave={(e) => handleButtonHover(e, false)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontWeight: '500',
              border: '1px solid #e2e8f0',
              cursor: isLoadingJobs ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              background: 'white',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.9rem',
              opacity: isLoadingJobs ? 0.7 : 1
            }}
          >
            {isLoadingJobs ? (
              <>
                <svg 
                  style={{ 
                    width: '16px', 
                    height: '16px', 
                    marginRight: '6px',
                    animation: 'spin 1s linear infinite'
                  }} 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4" 
                    fill="none" 
                    strokeDasharray="22" 
                    strokeDashoffset="0"
                  />
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg 
                  style={{ 
                    width: '16px', 
                    height: '16px', 
                    marginRight: '6px'
                  }} 
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>

        {jobsError && (
          <div style={{ 
            padding: '16px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '6px',
            fontSize: '0.9rem',
            marginBottom: '16px'
          }}>
            Error loading jobs: {jobsError}
            <button
              onClick={fetchJobs}
              style={{
                marginLeft: '10px',
                padding: '4px 10px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {isLoadingJobs && (
          <div style={{ 
            textAlign: 'center',
            padding: '20px',
            color: '#64748b'
          }}>
            <svg 
              style={{ 
                width: '24px', 
                height: '24px', 
                margin: '0 auto 10px',
                animation: 'spin 1s linear infinite',
                display: 'block'
              }} 
              viewBox="0 0 24 24"
            >
              <circle 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="none" 
                strokeDasharray="22" 
                strokeDashoffset="0"
              />
            </svg>
            Loading jobs...
          </div>
        )}

        {!isLoadingJobs && !jobsError && jobs.length === 0 && (
          <div style={{ 
            padding: '20px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.95rem'
          }}>
            No jobs found. Submit a quote to get started!
          </div>
        )}

        {!isLoadingJobs && !jobsError && jobs.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: windowWidth < 640 ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px'
          }}>
            {jobs.map(job => (
              <div 
                key={job.id} 
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '10px'
                }}>
                  <div style={{ fontWeight: '600', fontSize: '1rem', color: '#1e293b' }}>
                    {job.quantity} × {job.part_type}
                  </div>
                  <div style={{ 
                    fontWeight: '700', 
                    color: '#4caf50',
                    fontSize: '1.1rem' 
                  }}>
                    ${parseFloat(job.quote || job.quote_amount).toFixed(2)}
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                    <span style={{ 
                      display: 'inline-block',
                      backgroundColor: '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      marginRight: '6px'
                    }}>
                      {job.material}
                    </span>
                    <span style={{ 
                      display: 'inline-block',
                      backgroundColor: '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {job.complexity} complexity
                    </span>
                  </div>
                  
                  {job.deadline && (
                    <div style={{ 
                      fontSize: '0.85rem',
                      color: '#64748b',
                      marginTop: '4px'
                    }}>
                      Due: {formatDate(job.deadline)}
                    </div>
                  )}
                  
                  <div style={{ 
                    fontSize: '0.85rem',
                    color: '#94a3b8',
                    marginTop: '6px'
                  }}>
                    Created: {formatDateTime(job.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // Component to display AI Quote Result
  const AiQuoteResult = () => {
    if (!isAiQuoting && !aiQuoteResult && !aiQuoteError) return null;
    
    return (
      <div 
        style={{
          marginTop: '24px',
          border: '1px solid',
          borderColor: aiQuoteError ? '#fecaca' : '#e0e7ff',
          borderRadius: '8px',
          padding: '16px',
          backgroundColor: aiQuoteError ? '#fff5f5' : '#f5f7ff'
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h3 style={{ 
            margin: '0', 
            fontSize: '1.1rem',
            color: aiQuoteError ? '#b91c1c' : '#4338ca',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center'
          }}>
            <svg 
              style={{ 
                width: '20px', 
                height: '20px', 
                marginRight: '8px',
                color: aiQuoteError ? '#b91c1c' : '#4338ca'
              }} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {aiQuoteError ? (
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              ) : (
                <path d="M9.663 17h4.673M12 3c1.755 0 5.345.668 5.345 6.138 0 2.684-2.282 3.758-2.728 5.923H9.384c-.446-2.165-2.728-3.239-2.728-5.923C6.656 3.668 10.245 3 12 3z" />
              )}
            </svg>
            AI-Generated Quote
          </h3>
        </div>
        
        {isAiQuoting && (
          <div style={{ 
            textAlign: 'center',
            padding: '20px',
            color: '#6b7280'
          }}>
            <svg 
              style={{ 
                width: '24px', 
                height: '24px', 
                margin: '0 auto 10px',
                animation: 'spin 1s linear infinite',
                display: 'block'
              }} 
              viewBox="0 0 24 24"
            >
              <circle 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="none" 
                strokeDasharray="22" 
                strokeDashoffset="0"
              />
            </svg>
            <p style={{ margin: '0', fontSize: '0.95rem' }}>
              Analyzing similar jobs and generating quote...
            </p>
          </div>
        )}
        
        {aiQuoteError && !isAiQuoting && (
          <div style={{ 
            padding: '12px',
            color: '#b91c1c',
            fontSize: '0.95rem',
            lineHeight: '1.5'
          }}>
            {aiQuoteError}
          </div>
        )}
        
        {aiQuoteResult && !isAiQuoting && (
          <div style={{ 
            padding: '12px',
            textAlign: 'center'
          }}>
            <p style={{ 
              fontSize: '0.9rem',
              color: '#4338ca',
              margin: '0 0 8px 0'
            }}>
              Based on analysis of similar jobs in your history:
            </p>
            <div style={{ 
              fontSize: '2rem',
              fontWeight: '700',
              color: '#4f46e5',
              margin: '16px 0'
            }}>
              {aiQuoteResult}
            </div>
            <p style={{ 
              fontSize: '0.85rem',
              color: '#6b7280',
              margin: '12px 0 0 0',
              fontStyle: 'italic'
            }}>
              This suggestion is based on historical job data and market trends
            </p>
          </div>
        )}
      </div>
    );
  };
  
  // Initialize app on load
  useEffect(() => {
    const initializeApp = async () => {
      console.log('Initializing app...');
      try {
        // TEMPORARY OVERRIDE: Set to true to force disable demo mode
        const DISABLE_DEMO_MODE = true; // Set to true to bypass connection checks
        
        if (DISABLE_DEMO_MODE) {
          console.log('Demo mode override is active - forcing normal mode');
          setDemoMode(false);
          return;
        }
        
        // Check Supabase connection
        console.log('Checking Supabase connection...');
        const { isConnected, error } = await checkSupabaseConnection();
        console.log('Connection check result:', { isConnected, error });
        
        if (!isConnected) {
          console.error('Connection to Supabase failed:', error);
          setDemoMode(true);
          console.log('Demo mode activated due to connection failure');
          setSubmitStatus({
            type: 'error',
            message: 'Running in demo mode - not connected to database'
          });
          return;
        }
        
        console.log('Connected to Supabase successfully');
        
        // Try to verify jobs table exists
        console.log('Checking for jobs table...');
        const { success, error: tableError, needsManualTableCreation } = await createJobsTable();
        console.log('Table check result:', { success, tableError, needsManualTableCreation });
        
        if (needsManualTableCreation) {
          console.warn('Jobs table needs to be created manually in Supabase dashboard');
          setSubmitStatus({
            type: 'error',
            message: 'Please create the jobs table in your Supabase dashboard'
          });
          setDemoMode(true); // Use demo mode until table is created
          return;
        }
        
        if (!success) {
          console.warn('Failed to verify jobs table:', tableError);
          setSubmitStatus({
            type: 'error',
            message: 'Database connection issue - running in demo mode'
          });
          setDemoMode(true);
          return;
        }
        
        // Explicitly reset demo mode to false when connected
        setDemoMode(false);
        console.log('Demo mode explicitly disabled - normal mode active');
      } catch (err) {
        console.error('Error during app initialization:', err);
        setDemoMode(true);
        console.log('Demo mode activated due to initialization error');
      }

      // Initialize AOS animations
      if (typeof window !== 'undefined' && window.AOS) {
        window.AOS.init({
          duration: 1000,
          easing: 'ease-out',
          once: false
        });
      } else {
        console.warn('AOS library not available');
      }
    };

    initializeApp();
  }, []);
  
  // Custom hover animations that were removed
  const handleButtonHover = (e, enter) => {
    if (enter) {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 8px rgba(79, 70, 229, 0.25)';
    } else {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }
  };
  
  const handleCardHover = (e, enter) => {
    if (enter) {
      e.currentTarget.style.transform = 'translateY(-8px)';
      e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.05)';
      e.currentTarget.style.borderColor = '#e2e8f0';
    } else {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
      e.currentTarget.style.borderColor = '#f1f5f9';
    }
  };
  
  const handleCtaHover = (e, enter) => {
    if (enter) {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = '0 6px 12px rgba(79, 70, 229, 0.3)';
    } else {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 6px rgba(79, 70, 229, 0.25)';
    }
  };
  
  // Helper function to format dates safely
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleDateString();
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Invalid date';
    }
  };
  
  // Helper function to format datetime safely
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not set';
    
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (err) {
      console.error('Error formatting datetime:', err);
      return 'Invalid date';
    }
  };
  
  // Function to fetch jobs from Supabase
  const fetchJobs = async () => {
    console.log('Fetching jobs from Supabase...');
    setIsLoadingJobs(true);
    setJobsError(null);
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching jobs:', error);
        setJobsError(error.message);
        setJobs([]);
      } else {
        console.log('Successfully fetched jobs:', data);
        setJobs(data || []);
      }
    } catch (err) {
      console.error('Exception fetching jobs:', err);
      setJobsError(err.message);
      setJobs([]);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Fetch jobs on component mount
  useEffect(() => {
    // Only fetch if not in demo mode
    if (!demoMode) {
      fetchJobs();
    }
  }, [demoMode]);

  // Also fetch jobs when a new quote is successfully saved
  useEffect(() => {
    if (submitStatus.type === 'success' && !demoMode) {
      fetchJobs();
    }
  }, [submitStatus, demoMode]);
  
  // Fetch similar jobs by material or part type
  const fetchSimilarJobs = async (material, partType) => {
    console.log('Fetching similar jobs with material:', material, 'or part type:', partType);
    
    try {
      // First try to find jobs with similar material or part type
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .or(`material.ilike.%${material}%,part_type.ilike.%${partType}%`)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error fetching similar jobs:', error);
        return { success: false, error, data: [] };
      }
      
      console.log('Successfully fetched similar jobs:', data);
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('Exception fetching similar jobs:', err);
      return { success: false, error: err, data: [] };
    }
  };
  
  // Get AI quote suggestion
  const getAiQuoteSuggestion = async () => {
    // Reset previous results
    setAiQuoteResult(null);
    setAiQuoteError(null);
    setIsAiQuoting(true);
    
    // Validate form data first
    const validationErrors = {};
    if (!formData.partType.trim()) validationErrors.partType = 'Part type is required';
    if (!formData.material) validationErrors.material = 'Material is required';
    if (!formData.quantity || isNaN(parseInt(formData.quantity)) || parseInt(formData.quantity) <= 0) {
      validationErrors.quantity = 'Valid quantity is required';
    }
    
    // If there are errors, update the errors state and show an error message
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setAiQuoteError('Please fill in all required fields correctly before getting an AI suggestion.');
      setIsAiQuoting(false);
      return;
    }
    
    // Clear any previous errors
    setErrors({});
    
    try {
      // Fetch similar jobs from Supabase
      const { success, data: similarJobs, error } = await fetchSimilarJobs(formData.material, formData.partType);
      
      if (!success) {
        setAiQuoteError('Failed to fetch similar jobs for AI comparison: ' + error.message);
        setIsAiQuoting(false);
        return;
      }
      
      // Format deadline for the prompt
      let deadlineText = 'not specified';
      if (formData.deadline) {
        const deadlineDate = new Date(formData.deadline);
        const today = new Date();
        const diffTime = Math.abs(deadlineDate - today);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        deadlineText = `${diffDays} days`;
      }
      
      // Format the historical jobs for the prompt
      const historicalJobsText = similarJobs.map((job, index) => {
        let jobDeadline = 'not specified';
        if (job.deadline) {
          const jobCreatedDate = new Date(job.created_at);
          const jobDeadlineDate = new Date(job.deadline);
          const diffTime = Math.abs(jobDeadlineDate - jobCreatedDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          jobDeadline = `${diffDays} days`;
        }
        
        return `${index + 1}. Part: ${job.part_type}, Material: ${job.material}, Quantity: ${job.quantity}, Complexity: ${job.complexity}, Deadline: ${jobDeadline} → Quote: $${parseFloat(job.quote || job.quote_amount).toFixed(2)}`;
      }).join('\n');
      
      // Build the prompt for the AI
      const prompt = `You are a quoting assistant for a fabrication shop. Given the following historical quotes and a new job, suggest a reasonable quote amount.

Historical Jobs:
${historicalJobsText || "No historical data available for similar jobs."}

New Job:
Part: ${formData.partType}, Material: ${formData.material}, Quantity: ${formData.quantity}, Complexity: ${formData.complexity}, Deadline: ${deadlineText}

Return only the estimated quote as a dollar amount (e.g. $975.00).`;

      console.log('AI prompt:', prompt);
      
      // Call OpenAI API using axios and environment variable for API key
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant that provides price quotes for manufacturing jobs. Respond only with the dollar amount.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 50
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
            }
          }
        );
        
        // Extract the AI suggestion from the response
        const aiSuggestion = response.data.choices[0].message.content.trim();
        console.log('AI suggestion:', aiSuggestion);
        
        // If API call fails, fall back to a calculated mock response
        if (!aiSuggestion) {
          throw new Error('No valid response from AI');
        }
        
        // Update the state with the AI's suggestion
        setAiQuoteResult(aiSuggestion);
      } catch (apiErr) {
        console.error('Error calling OpenAI API:', apiErr);
        
        // Fall back to a mock response if the API call fails
        console.log('Falling back to mock response...');
        
        // MOCK RESPONSE FOR FALLBACK
        // Calculate a mock quote based on the form data
        const mockBasePrice = {
          'steel': 15,
          'aluminum': 10,
          'plastic': 5,
          'titanium': 50
        }[formData.material] || 10;
        
        const mockComplexityMultiplier = {
          'low': 1.0,
          'medium': 1.5,
          'high': 2.5
        }[formData.complexity] || 1.5;
        
        // Create slight variations using historical data influence (simulated)
        const hasSimilarJobs = similarJobs.length > 0;
        let variationFactor = 0.9 + (Math.random() * 0.3); // 0.9 to 1.2 range
        
        if (hasSimilarJobs) {
          // Adjust variation to make it feel like it's using similar jobs data
          variationFactor = 0.95 + (Math.random() * 0.2); // Tighter range (0.95 to 1.15)
        }
        
        const quantity = parseInt(formData.quantity);
        const mockQuote = mockBasePrice * mockComplexityMultiplier * Math.max(1, Math.log10(quantity) + 1) * quantity * variationFactor;
        
        // Format mockQuote as a dollar amount
        const fallbackSuggestion = `$${parseFloat(mockQuote).toFixed(2)}`;
        
        console.log('AI suggestion (fallback):', fallbackSuggestion);
        
        // Set an error message but still show the fallback price
        setAiQuoteError('Could not reach AI service. Showing an estimated quote instead.');
        setAiQuoteResult(fallbackSuggestion);
      }
    } catch (err) {
      console.error('Error in AI quote suggestion process:', err);
      setAiQuoteError(`Error getting AI quote: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAiQuoting(false);
    }
  };
  
  // Add scroll to quote form function
  const scrollToQuoteForm = () => {
    if (quoteFormRef.current) {
      quoteFormRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };
  
  // Handle material price change
  const handleMaterialPriceChange = (material, value) => {
    const updatedPrices = {
      ...materialPrices,
      [material]: parseFloat(value) || 0
    };
    
    setMaterialPrices(updatedPrices);
    
    // Check if any price differs from the default
    const isCustomized = Object.keys(updatedPrices).some(
      mat => updatedPrices[mat] !== defaultMaterialPrices[mat]
    );
    
    setPricesCustomized(isCustomized);
    
    // Save to localStorage
    localStorage.setItem('materialPrices', JSON.stringify(updatedPrices));
  };
  
  // Reset material prices to defaults
  const resetMaterialPrices = () => {
    setMaterialPrices({...defaultMaterialPrices});
    setPricesCustomized(false);
    
    // Save to localStorage
    localStorage.setItem('materialPrices', JSON.stringify(defaultMaterialPrices));
  };
  
  // Save advanced options to localStorage
  const saveAdvancedOptions = (options) => {
    const advancedOptions = options || {
      rushFeeEnabled,
      rushFeeAmount,
      marginPercentage
    };
    localStorage.setItem('advancedOptions', JSON.stringify(advancedOptions));
  };
  
  // Handle rush fee toggle
  const handleRushFeeToggle = (checked) => {
    const newOptions = {
      rushFeeEnabled: checked,
      rushFeeAmount,
      marginPercentage
    };
    setRushFeeEnabled(checked);
    saveAdvancedOptions(newOptions);
  };
  
  // Handle rush fee amount change
  const handleRushFeeAmountChange = (amount) => {
    const newOptions = {
      rushFeeEnabled,
      rushFeeAmount: amount,
      marginPercentage
    };
    setRushFeeAmount(amount);
    saveAdvancedOptions(newOptions);
  };
  
  // Handle margin percentage change
  const handleMarginChange = (percentage) => {
    const newOptions = {
      rushFeeEnabled,
      rushFeeAmount,
      marginPercentage: percentage
    };
    setMarginPercentage(percentage);
    saveAdvancedOptions(newOptions);
  };
  
  return (
    <div style={{ 
      backgroundColor: '#f8fafc', 
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      color: '#0f172a',
      transition: 'all 0.3s ease',
      overflowX: 'hidden' // Added to prevent horizontal scroll during animations
    }}>
      {/* Fixed Header with improved styling */}
      <header style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        backgroundColor: 'white', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
        zIndex: 10,
        transition: 'all 0.3s ease'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', height: '72px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span 
                data-aos="fade-right"
                style={{ 
                  color: '#4f46e5', 
                  fontWeight: 'bold', 
                  fontSize: '24px', 
                  letterSpacing: '-0.025em',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <svg 
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    marginRight: '10px',
                    color: '#4f46e5'
                  }} 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                <span style={{ 
                  '@media (max-width: 480px)': { 
                    display: 'none' 
                  } 
                }}>
                  FactoryFlow
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button 
                data-aos="fade-left"
                onMouseEnter={(e) => handleButtonHover(e, true)}
                onMouseLeave={(e) => handleButtonHover(e, false)}
                onClick={scrollToQuoteForm}
                style={{ 
                  color: 'white', 
                  backgroundColor: '#4f46e5', 
                  padding: '10px 20px', 
                  borderRadius: '8px', 
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: windowWidth < 480 ? '14px' : '16px'
                }}
              >
                Get a Quote
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with AOS animations */}
      <div style={{ paddingTop: '96px' }}>
        {/* Hero Section */}
        <div 
          style={{ 
            padding: windowWidth < 768 ? '32px 16px' : '48px 20px',
            background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 50%, #f8fafc 100%)',
          }}
        >
          <h1 
            data-aos="fade-up"
            style={{ 
              fontSize: windowWidth < 768 ? '2.25rem' : '3rem', 
              fontWeight: 'bold', 
              textAlign: 'center', 
              margin: '32px 0', 
              color: '#1e293b',
              lineHeight: '1.2'
            }}
          >
            Quoting. Scheduling. <br/>
            <span style={{ color: '#4f46e5' }}>Simplified.</span>
          </h1>
          <p 
            data-aos="fade-up"
            data-aos-delay="200"
            style={{ 
              fontSize: windowWidth < 768 ? '1rem' : '1.25rem', 
              color: '#475569', 
              textAlign: 'center', 
              marginBottom: '48px',
              maxWidth: '700px',
              margin: '0 auto 48px',
              padding: '0 16px'
            }}
          >
            FactoryFlow helps fabrication shops save hours every week with intelligent quoting and streamlined job management.
          </p>
          <div 
            data-aos="fade-up"
            data-aos-delay="300"
            style={{ 
              display: 'flex', 
              justifyContent: 'center'
            }}
          >
            <button 
              onClick={scrollToQuoteForm}
              onMouseEnter={(e) => handleCtaHover(e, true)}
              onMouseLeave={(e) => handleCtaHover(e, false)}
              style={{
                background: 'linear-gradient(to right, #4f46e5, #6366f1)',
                color: 'white',
                padding: windowWidth < 480 ? '12px 24px' : '14px 32px',
                borderRadius: '12px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.3s ease',
                fontSize: windowWidth < 480 ? '15px' : '16px'
              }}
            >
              Start Quoting Now
            </button>
          </div>
        </div>
        
        {/* Quote Form - Enhanced with AOS animations */}
        <div 
          ref={quoteFormRef}
          style={{ 
            maxWidth: '800px', 
            margin: '60px auto 48px', 
            backgroundColor: 'white', 
            borderRadius: '16px', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)', 
            overflow: 'hidden',
            marginLeft: windowWidth < 768 ? '16px' : 'auto',
            marginRight: windowWidth < 768 ? '16px' : 'auto',
          }}
        >
          <div style={{ 
            background: 'linear-gradient(to right, #4f46e5, #6366f1)', 
            padding: windowWidth < 480 ? '20px 24px' : '28px 32px'
          }}>
            <h2 
              data-aos="fade-right"
              style={{ 
                fontSize: windowWidth < 480 ? '20px' : '24px', 
                fontWeight: '600', 
                color: 'white',
                margin: '0 0 8px 0'
              }}
            >
              Create a New Quote
            </h2>
            <p 
              data-aos="fade-right"
              data-aos-delay="100"
              style={{ 
                color: '#c7d2fe',
                margin: 0,
                fontSize: windowWidth < 480 ? '14px' : '16px'
              }}
            >
              Fill out the form below to get an instant quote
            </p>
          </div>
          
          <div style={{ padding: windowWidth < 480 ? '24px 20px' : '32px' }}>
            {demoMode && <DemoModeBanner />}
            
            {/* Customize Material Prices Section */}
            <div style={{
              marginBottom: '24px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <div 
                onClick={() => setShowMaterialPrices(!showMaterialPrices)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontWeight: '500',
                  color: '#4f46e5'
                }}>
                  <svg 
                    style={{ 
                      width: '18px', 
                      height: '18px', 
                      marginRight: '8px',
                      color: '#4f46e5'
                    }} 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Customize Material Prices
                  {pricesCustomized && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      padding: '2px 6px',
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      Custom
                    </span>
                  )}
                </div>
                <svg 
                  style={{ 
                    width: '18px', 
                    height: '18px',
                    color: '#6b7280',
                    transform: showMaterialPrices ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }} 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              
              {showMaterialPrices && (
                <div 
                  style={{
                    padding: '16px',
                    borderTop: '1px solid #e2e8f0'
                  }}
                >
                  <p style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '0.9rem', 
                    color: '#64748b' 
                  }}>
                    Adjust the base prices for each material to customize your quotes.
                  </p>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: windowWidth < 640 ? '1fr' : 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    {Object.keys(materialPrices).map(material => (
                      <div key={material}>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#475569',
                          marginBottom: '6px',
                          textTransform: 'capitalize'
                        }}>
                          {material}
                        </label>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          position: 'relative'
                        }}>
                          <span style={{
                            position: 'absolute',
                            left: '10px',
                            color: '#64748b',
                            fontSize: '14px'
                          }}>
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={materialPrices[material]}
                            onChange={(e) => handleMaterialPriceChange(material, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 8px 8px 26px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              fontSize: '14px',
                              transition: 'all 0.2s ease'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={resetMaterialPrices}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    Reset to Defaults
                  </button>
                </div>
              )}
            </div>
            
            <div 
              data-aos="fade-up"
              style={{ 
                marginBottom: '24px'
              }}
            >
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#475569',
                marginBottom: '8px'
              }}>
                Part Type
              </label>
              <input
                type="text"
                name="partType"
                value={formData.partType}
                onChange={handleChange}
                placeholder="e.g. Gear, Bracket, Housing"
                style={{
                  width: '100%',
                  padding: windowWidth < 480 ? '10px 14px' : '12px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${errors.partType ? '#ef4444' : '#e2e8f0'}`,
                  fontSize: windowWidth < 480 ? '14px' : '16px',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = errors.partType ? '#ef4444' : '#4f46e5'}
                onBlur={(e) => e.target.style.borderColor = errors.partType ? '#ef4444' : '#e2e8f0'}
              />
              {errors.partType && (
                <p style={{ 
                  color: '#ef4444', 
                  fontSize: '14px', 
                  marginTop: '4px',
                  marginBottom: '0'
                }}>
                  {errors.partType}
                </p>
              )}
            </div>
            
            <div 
              data-aos="fade-up"
              data-aos-delay="100"
              style={{ 
                display: 'grid', 
                gridTemplateColumns: windowWidth < 640 ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', 
                gap: windowWidth < 640 ? '16px' : '24px',
                marginBottom: '24px'
              }}
            >
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Material
                </label>
                <select
                  name="material"
                  value={formData.material}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${errors.material ? '#ef4444' : '#e2e8f0'}`,
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = errors.material ? '#ef4444' : '#4f46e5'}
                  onBlur={(e) => e.target.style.borderColor = errors.material ? '#ef4444' : '#e2e8f0'}
                >
                  <option value="steel">Steel</option>
                  <option value="aluminum">Aluminum</option>
                  <option value="plastic">Plastic</option>
                </select>
                {errors.material && (
                  <p style={{ 
                    color: '#ef4444', 
                    fontSize: '14px', 
                    marginTop: '4px',
                    marginBottom: '0'
                  }}>
                    {errors.material}
                  </p>
                )}
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${errors.quantity ? '#ef4444' : '#e2e8f0'}`,
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = errors.quantity ? '#ef4444' : '#4f46e5'}
                  onBlur={(e) => e.target.style.borderColor = errors.quantity ? '#ef4444' : '#e2e8f0'}
                />
                {errors.quantity && (
                  <p style={{ 
                    color: '#ef4444', 
                    fontSize: '14px', 
                    marginTop: '4px',
                    marginBottom: '0'
                  }}>
                    {errors.quantity}
                  </p>
                )}
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Complexity
                </label>
                <select
                  name="complexity"
                  value={formData.complexity}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${errors.complexity ? '#ef4444' : '#e2e8f0'}`,
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = errors.complexity ? '#ef4444' : '#4f46e5'}
                  onBlur={(e) => e.target.style.borderColor = errors.complexity ? '#ef4444' : '#e2e8f0'}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                {errors.complexity && (
                  <p style={{ 
                    color: '#ef4444', 
                    fontSize: '14px', 
                    marginTop: '4px',
                    marginBottom: '0'
                  }}>
                    {errors.complexity}
                  </p>
                )}
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#475569',
                  marginBottom: '8px'
                }}>
                  Deadline (Optional)
                </label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `1px solid #e2e8f0`,
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '16px',
              flexDirection: windowWidth < 480 ? 'column' : 'row'
            }}>
              <button
                data-aos="fade-up"
                data-aos-delay="200"
                onClick={calculateQuote}
                onMouseEnter={(e) => handleButtonHover(e, true)}
                onMouseLeave={(e) => handleButtonHover(e, false)}
                style={{
                  flex: 1,
                  background: isCalculating ? '#a5b4fc' : 'linear-gradient(to right, #4f46e5, #6366f1)',
                  color: 'white',
                  padding: '14px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: isCalculating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <>
                    <svg 
                      style={{ 
                        width: '20px', 
                        height: '20px', 
                        marginRight: '8px',
                        animation: 'spin 1s linear infinite'
                      }} 
                      viewBox="0 0 24 24"
                    >
                      <style>
                        {`
                          @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                          }
                        `}
                      </style>
                      <circle 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="none" 
                        strokeDasharray="22" 
                        strokeDashoffset="0"
                      />
                    </svg>
                    Calculating...
                  </>
                ) : 'Calculate Quote'}
              </button>
              
              <button
                data-aos="fade-up"
                data-aos-delay="225"
                onClick={getAiQuoteSuggestion}
                onMouseEnter={(e) => handleButtonHover(e, true)}
                onMouseLeave={(e) => handleButtonHover(e, false)}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  border: '1px solid #4f46e5',
                  backgroundColor: 'white',
                  color: '#4f46e5',
                  cursor: isAiQuoting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: isAiQuoting ? 0.7 : 1
                }}
                disabled={isAiQuoting}
              >
                {isAiQuoting ? (
                  <>
                    <svg 
                      style={{ 
                        width: '20px', 
                        height: '20px', 
                        marginRight: '8px',
                        animation: 'spin 1s linear infinite'
                      }} 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="none" 
                        strokeDasharray="22" 
                        strokeDashoffset="0"
                      />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg
                      style={{
                        width: '20px',
                        height: '20px',
                        marginRight: '8px'
                      }}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.663 17h4.673M12 3c1.755 0 5.345.668 5.345 6.138 0 2.684-2.282 3.758-2.728 5.923H9.384c-.446-2.165-2.728-3.239-2.728-5.923C6.656 3.668 10.245 3 12 3z" />
                    </svg>
                    Suggest Quote with AI
                  </>
                )}
              </button>
              
              <button
                data-aos="fade-up"
                data-aos-delay="250"
                onMouseEnter={(e) => handleButtonHover(e, true)}
                onMouseLeave={(e) => handleButtonHover(e, false)}
                style={{
                  padding: '14px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  border: '1px solid #e2e8f0',
                  cursor: isCalculating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  marginTop: '16px',
                  background: 'white',
                  color: '#475569',
                  opacity: isCalculating ? 0.7 : 1
                }}
                onClick={resetForm}
              >
                Reset
              </button>
            </div>
            
            {/* Advanced Options Section */}
            <div style={{
              marginTop: '24px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <div 
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontWeight: '500',
                  color: '#4f46e5'
                }}>
                  <svg 
                    style={{ 
                      width: '18px', 
                      height: '18px', 
                      marginRight: '8px',
                      color: '#4f46e5'
                    }} 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Advanced Options
                  {(rushFeeEnabled || marginPercentage !== 20) && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      padding: '2px 6px',
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      Custom
                    </span>
                  )}
                </div>
                <svg 
                  style={{ 
                    width: '18px', 
                    height: '18px',
                    color: '#6b7280',
                    transform: showAdvancedOptions ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }} 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              
              {showAdvancedOptions && (
                <div 
                  style={{
                    padding: '16px',
                    borderTop: '1px solid #e2e8f0'
                  }}
                >
                  <p style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '0.9rem', 
                    color: '#64748b' 
                  }}>
                    Fine-tune your quote with these advanced options.
                  </p>
                  
                  {/* Rush Fee Option */}
                  <div style={{
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#475569',
                        cursor: 'pointer'
                      }}>
                        <input 
                          type="checkbox"
                          checked={rushFeeEnabled}
                          onChange={(e) => handleRushFeeToggle(e.target.checked)}
                          style={{
                            marginRight: '8px',
                            accentColor: '#4f46e5'
                          }}
                        />
                        Add Rush Fee
                      </label>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        position: 'relative'
                      }}>
                        <span style={{
                          position: 'absolute',
                          left: '10px',
                          color: '#64748b',
                          fontSize: '14px'
                        }}>
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={rushFeeAmount}
                          onChange={(e) => handleRushFeeAmountChange(parseInt(e.target.value) || 0)}
                          disabled={!rushFeeEnabled}
                          style={{
                            width: '80px',
                            padding: '8px 8px 8px 26px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            fontSize: '14px',
                            transition: 'all 0.2s ease',
                            opacity: rushFeeEnabled ? 1 : 0.5
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </div>
                    </div>
                    
                    <p style={{
                      margin: '0',
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      paddingLeft: '24px'
                    }}>
                      Adds a flat fee for expedited service
                    </p>
                  </div>
                  
                  {/* Margin Percentage */}
                  <div style={{
                    marginBottom: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <label style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#475569',
                    }}>
                      Profit Margin
                    </label>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {[10, 20, 30].map((percentage) => (
                        <button
                          key={percentage}
                          onClick={() => handleMarginChange(percentage)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor: marginPercentage === percentage ? '#4f46e5' : '#e2e8f0',
                            background: marginPercentage === percentage ? '#eef2ff' : 'white',
                            color: marginPercentage === percentage ? '#4f46e5' : '#64748b',
                            fontWeight: marginPercentage === percentage ? '600' : '500',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (marginPercentage !== percentage) {
                              e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.background = '#f8fafc';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (marginPercentage !== percentage) {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.background = 'white';
                            }
                          }}
                        >
                          {percentage}%
                        </button>
                      ))}
                    </div>
                    
                    <p style={{
                      margin: '0',
                      fontSize: '0.8rem',
                      color: '#94a3b8'
                    }}>
                      Applies a percentage increase to the base manufacturing cost
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Status message for submission feedback */}
            {submitStatus.message && (
              <div 
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: submitStatus.type === 'success' ? '#dcfce7' : '#fee2e2',
                  color: submitStatus.type === 'success' ? '#166534' : '#b91c1c',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {submitStatus.type === 'success' ? (
                  <svg 
                    style={{ width: '20px', height: '20px', marginRight: '8px' }} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M5 13l4 4L19 7" 
                    />
                  </svg>
                ) : (
                  <svg 
                    style={{ width: '20px', height: '20px', marginRight: '8px' }} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M6 18L18 6M6 6l12 12" 
                    />
                  </svg>
                )}
                {submitStatus.message}
              </div>
            )}
            
            {/* AI Quote Result */}
            <AiQuoteResult />
            
            {quote !== null && (
              <div 
                ref={quoteResultRef}
                data-aos="zoom-in"
                className="quote-result"
                style={{
                  marginTop: '32px',
                  padding: '24px',
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0'
                }}
              >
                <p 
                  style={{ 
                    fontSize: '16px',
                    color: '#475569',
                    margin: '0 0 8px 0'
                  }}
                >
                  Estimated cost for your project:
                </p>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <p 
                    style={{
                      fontSize: '36px',
                      fontWeight: '700',
                      color: '#4f46e5',
                      margin: '0',
                      cursor: 'help'
                    }}
                    onMouseEnter={() => setShowPriceTooltip(true)}
                    onMouseLeave={() => setShowPriceTooltip(false)}
                  >
                    {new Intl.NumberFormat('en-US', { 
                      style: 'currency', 
                      currency: 'USD',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(quote)}
                    {priceDetails && (
                      <svg 
                        style={{ 
                          width: '16px', 
                          height: '16px', 
                          marginLeft: '8px',
                          verticalAlign: 'middle',
                          color: '#94a3b8'
                        }} 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                    )}
                  </p>
                  
                  {/* Tooltip for price breakdown */}
                  {showPriceTooltip && priceDetails && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'white',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      zIndex: 100,
                      width: '260px',
                      textAlign: 'left',
                      color: '#475569',
                      fontSize: '14px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '8px', textAlign: 'center', color: '#4f46e5' }}>
                        Price Calculation
                      </div>
                      
                      {/* Base manufacturing costs */}
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Manufacturing Costs:</div>
                        <div style={{ marginBottom: '4px', paddingLeft: '8px' }}>
                          <span style={{ fontWeight: '500' }}>Material:</span> {priceDetails.material} (${priceDetails.basePrice})
                        </div>
                        <div style={{ marginBottom: '4px', paddingLeft: '8px' }}>
                          <span style={{ fontWeight: '500' }}>Complexity:</span> {priceDetails.complexity} (x{priceDetails.complexityMultiplier})
                        </div>
                        <div style={{ marginBottom: '4px', paddingLeft: '8px' }}>
                          <span style={{ fontWeight: '500' }}>Quantity:</span> {priceDetails.quantity} (x{priceDetails.quantityMultiplier})
                        </div>
                        <div style={{ marginBottom: '4px', paddingLeft: '8px' }}>
                          <span style={{ fontWeight: '500' }}>Market adjustment:</span> x{priceDetails.randomFactor}
                        </div>
                        <div style={{ 
                          fontWeight: '500',
                          padding: '4px 8px',
                          marginTop: '4px',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}>
                          <span>Base Cost:</span>
                          <span>${priceDetails.baseCost}</span>
                        </div>
                      </div>
                      
                      {/* Additional costs */}
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Additional Factors:</div>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          marginBottom: '4px',
                          paddingLeft: '8px'
                        }}>
                          <span style={{ fontWeight: '500' }}>Profit Margin ({priceDetails.marginPercentage}%):</span>
                          <span>x{priceDetails.marginMultiplier}</span>
                        </div>
                        
                        {priceDetails.rushFeeEnabled && (
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                            paddingLeft: '8px'
                          }}>
                            <span style={{ fontWeight: '500' }}>Rush Fee:</span>
                            <span>+${priceDetails.rushFeeAmount}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Final price */}
                      <div style={{ 
                        borderTop: '1px dashed #e2e8f0', 
                        paddingTop: '8px',
                        marginTop: '8px',
                        fontWeight: '600',
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: '#4f46e5'
                      }}>
                        <span>TOTAL QUOTE:</span>
                        <span>${priceDetails.finalQuote}</span>
                      </div>
                      
                      {/* Arrow pointing down */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: '12px',
                        height: '12px',
                        backgroundColor: 'white',
                        borderRight: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0'
                      }}></div>
                    </div>
                  )}
                </div>
                
                {/* Information about job storage */}
                {submitStatus.type === 'success' && (
                  <div style={{
                    marginTop: '16px',
                    fontSize: '14px',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg 
                      style={{ width: '16px', height: '16px', marginRight: '6px' }} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    This quote has been saved to your account
                  </div>
                )}
              </div>
            )}
            
            <SavedQuotes />
            <JobList />
          </div>
        </div>
        
        {/* Benefits */}
        <div 
          style={{ 
            padding: '80px 0', 
            backgroundColor: '#ffffff'
          }}
        >
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
            <h2 
              data-aos="fade-up"
              style={{ 
                fontSize: '32px', 
                fontWeight: 'bold', 
                color: '#1e293b', 
                marginBottom: '16px', 
                textAlign: 'center'
              }}
            >
              Why Choose FactoryFlow
            </h2>
            <p 
              data-aos="fade-up"
              data-aos-delay="100"
              style={{
                fontSize: '18px',
                color: '#475569',
                textAlign: 'center',
                maxWidth: '700px',
                margin: '0 auto 48px'
              }}
            >
              Our platform helps fabrication shops streamline their operations and boost profitability.
            </p>
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                gap: '32px', 
                marginTop: '32px'
              }}
            >
              <div 
                data-aos="fade-up"
                data-aos-delay="200"
                onMouseEnter={(e) => handleCardHover(e, true)}
                onMouseLeave={(e) => handleCardHover(e, false)}
                style={{ 
                  backgroundColor: 'white', 
                  padding: '32px', 
                  borderRadius: '16px', 
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  border: '1px solid #f1f5f9',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '12px', 
                  backgroundColor: '#eef2ff', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <svg style={{ width: '28px', height: '28px', color: '#4f46e5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: '#1e293b', 
                  marginBottom: '12px', 
                  textAlign: 'center' 
                }}>
                  Faster Quotes
                </h3>
                <p style={{ color: '#475569', textAlign: 'center', lineHeight: '1.6' }}>
                  Generate accurate quotes in seconds instead of hours, increasing your response rate and win rate.
                </p>
              </div>
              
              <div 
                data-aos="fade-up"
                data-aos-delay="300"
                onMouseEnter={(e) => handleCardHover(e, true)}
                onMouseLeave={(e) => handleCardHover(e, false)}
                style={{ 
                  backgroundColor: 'white', 
                  padding: '32px', 
                  borderRadius: '16px', 
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  border: '1px solid #f1f5f9',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '12px', 
                  backgroundColor: '#eef2ff', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <svg style={{ width: '28px', height: '28px', color: '#4f46e5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: '#1e293b', 
                  marginBottom: '12px', 
                  textAlign: 'center' 
                }}>
                  No More Spreadsheets
                </h3>
                <p style={{ color: '#475569', textAlign: 'center', lineHeight: '1.6' }}>
                  Say goodbye to outdated spreadsheets and manual calculations that are prone to errors.
                </p>
              </div>
              
              <div 
                data-aos="fade-up"
                data-aos-delay="400"
                onMouseEnter={(e) => handleCardHover(e, true)}
                onMouseLeave={(e) => handleCardHover(e, false)}
                style={{ 
                  backgroundColor: 'white', 
                  padding: '32px', 
                  borderRadius: '16px', 
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  border: '1px solid #f1f5f9',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '12px', 
                  backgroundColor: '#eef2ff', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <svg style={{ width: '28px', height: '28px', color: '#4f46e5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: '#1e293b', 
                  marginBottom: '12px', 
                  textAlign: 'center' 
                }}>
                  Smarter Scheduling
                </h3>
                <p style={{ color: '#475569', textAlign: 'center', lineHeight: '1.6' }}>
                  Optimize your shop's capacity by intelligently scheduling jobs based on deadlines and machine availability.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <footer 
          style={{ 
            backgroundColor: '#1e293b', 
            color: 'white', 
            padding: '48px 0 24px',
            marginTop: '48px'
          }}
        >
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px', textAlign: 'center' }}>
            <div 
              style={{ marginBottom: '32px' }}
            >
              <span 
                style={{ 
                  color: 'white', 
                  fontWeight: 'bold', 
                  fontSize: '24px', 
                  letterSpacing: '-0.025em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg 
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    marginRight: '10px',
                    color: 'white'
                  }} 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                FactoryFlow
              </span>
            </div>
            <p 
              style={{ 
                color: '#94a3b8', 
                maxWidth: '500px', 
                margin: '0 auto 24px', 
                fontSize: '14px' 
              }}
            >
              Helping fabrication shops streamline operations with intelligent quoting and job scheduling.
            </p>
            <p 
              style={{ 
                color: '#64748b', 
                fontSize: '14px' 
              }}
            >
              © {new Date().getFullYear()} FactoryFlow. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;


// On page load, fetch all jobs from the Supabase 'jobs' table,
// and store them in the local jobs array state

// Add a button to the form that allows users to clear the form and reset it to its initial state




