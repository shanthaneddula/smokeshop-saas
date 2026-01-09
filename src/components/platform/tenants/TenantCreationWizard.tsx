'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'business' | 'domain' | 'database' | 'admin' | 'review';

interface TenantFormData {
  // Business Info
  businessName: string;
  slug: string;
  industry: string;
  
  // Domain (tenant's own domain, not subdomain)
  customDomain: string;
  
  // Plan
  planId: string;
  
  // Database Configuration (Supabase)
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbPort: number;
  supabaseProjectId: string;
  supabaseUrl: string;
  
  // Admin User
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone: string;
}

// Generate slug from business name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

export default function TenantCreationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('business');
  const [formData, setFormData] = useState<TenantFormData>({
    businessName: '',
    slug: '',
    industry: 'smoke-shop',
    customDomain: '',
    planId: 'starter',
    dbHost: '',
    dbName: 'postgres',
    dbUser: 'postgres',
    dbPassword: '',
    dbPort: 5432,
    supabaseProjectId: '',
    supabaseUrl: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerPhone: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const steps: Step[] = ['business', 'domain', 'database', 'admin', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);

  const stepLabels: Record<Step, string> = {
    business: 'Business Info',
    domain: 'Domain',
    database: 'Database',
    admin: 'Admin User',
    review: 'Review',
  };

  // Validate current step before proceeding
  const validateStep = (): boolean => {
    const errors: Record<string, string> = {};
    
    switch (currentStep) {
      case 'business':
        if (!formData.businessName.trim()) {
          errors.businessName = 'Business name is required';
        }
        if (!formData.slug.trim()) {
          errors.slug = 'Slug is required';
        } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
          errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
        }
        break;
        
      case 'domain':
        if (formData.customDomain) {
          // Basic domain validation
          const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
          if (!domainRegex.test(formData.customDomain)) {
            errors.customDomain = 'Please enter a valid domain (e.g., joessmokeshop.com)';
          }
        }
        // Domain is optional at creation - tenant can add later
        break;
        
      case 'database':
        if (!formData.dbHost.trim()) {
          errors.dbHost = 'Database host is required';
        }
        if (!formData.dbPassword.trim()) {
          errors.dbPassword = 'Database password is required';
        }
        break;
        
      case 'admin':
        if (!formData.ownerName.trim()) {
          errors.ownerName = 'Owner name is required';
        }
        if (!formData.ownerEmail.trim()) {
          errors.ownerEmail = 'Owner email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
          errors.ownerEmail = 'Please enter a valid email address';
        }
        if (!formData.ownerPassword) {
          errors.ownerPassword = 'Password is required';
        } else if (formData.ownerPassword.length < 8) {
          errors.ownerPassword = 'Password must be at least 8 characters';
        }
        break;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    
    const nextStep = steps[currentStepIndex + 1];
    if (nextStep) setCurrentStep(nextStep);
  };

  const handleBack = () => {
    const prevStep = steps[currentStepIndex - 1];
    if (prevStep) setCurrentStep(prevStep);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.businessName,
          slug: formData.slug,
          customDomain: formData.customDomain || undefined,
          ownerEmail: formData.ownerEmail,
          ownerName: formData.ownerName,
          ownerPassword: formData.ownerPassword,
          phone: formData.ownerPhone || undefined,
          dbHost: formData.dbHost,
          dbName: formData.dbName,
          dbUser: formData.dbUser,
          dbPassword: formData.dbPassword,
          dbPort: formData.dbPort,
          supabaseProjectId: formData.supabaseProjectId || undefined,
          supabaseUrl: formData.supabaseUrl || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create tenant');
      }

      // Redirect to tenant detail page with success message
      router.push(`/platform/dashboard?created=${data.tenant?.slug || 'true'}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update slug when business name changes
  const handleBusinessNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      businessName: name,
      slug: prev.slug || generateSlug(name),
    }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`flex-1 ${index !== 0 ? 'ml-2' : ''}`}
            >
              <div
                className={`h-2 rounded ${
                  index <= currentStepIndex
                    ? 'bg-blue-600'
                    : 'bg-gray-600'
                }`}
              />
              <p className="text-xs mt-2 uppercase tracking-wide text-gray-400">
                {stepLabels[step]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
        {currentStep === 'business' && (
          <BusinessInfoStep
            data={formData}
            onChange={setFormData}
            onBusinessNameChange={handleBusinessNameChange}
            errors={validationErrors}
          />
        )}
        {currentStep === 'domain' && (
          <DomainStep
            data={formData}
            onChange={setFormData}
            errors={validationErrors}
          />
        )}
        {currentStep === 'database' && (
          <DatabaseStep
            data={formData}
            onChange={setFormData}
            errors={validationErrors}
          />
        )}
        {currentStep === 'admin' && (
          <AdminUserStep
            data={formData}
            onChange={setFormData}
            errors={validationErrors}
          />
        )}
        {currentStep === 'review' && (
          <ReviewStep data={formData} />
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 text-red-400 rounded-lg">
          <div className="font-medium">Error creating tenant</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={handleBack}
          disabled={currentStepIndex === 0 || isSubmitting}
          className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>

        {currentStep === 'review' ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Tenant...
              </span>
            ) : (
              'Create Tenant'
            )}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// STEP COMPONENTS
// ============================================

interface StepProps {
  data: TenantFormData;
  onChange: React.Dispatch<React.SetStateAction<TenantFormData>>;
  errors?: Record<string, string>;
}

interface BusinessInfoStepProps extends StepProps {
  onBusinessNameChange: (name: string) => void;
}

function BusinessInfoStep({ data, onChange, onBusinessNameChange, errors = {} }: BusinessInfoStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Business Information</h2>
        <p className="text-gray-400">Enter the basic details about the smoke shop business.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Business Name *
          </label>
          <input
            type="text"
            value={data.businessName}
            onChange={(e) => onBusinessNameChange(e.target.value)}
            placeholder="Joe's Smoke Shop"
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.businessName ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          {errors.businessName && (
            <p className="mt-1 text-sm text-red-400">{errors.businessName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Slug (Internal Identifier) *
          </label>
          <input
            type="text"
            value={data.slug}
            onChange={(e) => onChange(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
            placeholder="joes-smoke-shop"
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.slug ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          <p className="mt-1 text-xs text-gray-500">
            Lowercase letters, numbers, and hyphens only. Used for internal identification.
          </p>
          {errors.slug && (
            <p className="mt-1 text-sm text-red-400">{errors.slug}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Industry
          </label>
          <select
            value={data.industry}
            onChange={(e) => onChange(prev => ({ ...prev, industry: e.target.value }))}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="smoke-shop">Smoke Shop</option>
            <option value="vape-shop">Vape Shop</option>
            <option value="head-shop">Head Shop</option>
            <option value="tobacco-store">Tobacco Store</option>
            <option value="dispensary">Dispensary</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Plan
          </label>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'starter', name: 'Starter', price: '$49/mo', desc: 'Perfect for single locations' },
              { id: 'growth', name: 'Growth', price: '$99/mo', desc: 'For growing businesses' },
              { id: 'enterprise', name: 'Enterprise', price: 'Custom', desc: 'For large operations' },
            ].map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => onChange(prev => ({ ...prev, planId: plan.id }))}
                className={`p-4 border rounded-lg text-left transition-all ${
                  data.planId === plan.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="font-medium text-white">{plan.name}</div>
                <div className="text-blue-400 text-sm font-semibold">{plan.price}</div>
                <div className="text-gray-500 text-xs mt-1">{plan.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DomainStep({ data, onChange, errors = {} }: StepProps) {
  const [domainStatus, setDomainStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [domainMessage, setDomainMessage] = useState('');
  const previousDomain = useRef(data.customDomain);

  // Debounced domain check
  useEffect(() => {
    // Only reset if domain was cleared
    if (!data.customDomain && previousDomain.current) {
      previousDomain.current = '';
      setDomainStatus('idle');
      setDomainMessage('');
      return;
    }
    
    if (!data.customDomain) {
      return;
    }

    const timer = setTimeout(async () => {
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(data.customDomain)) {
        setDomainStatus('idle');
        return;
      }

      setDomainStatus('checking');
      previousDomain.current = data.customDomain;
      
      try {
        const response = await fetch('/api/platform/tenants/check-domain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: data.customDomain }),
        });
        
        const result = await response.json();
        
        if (result.available) {
          setDomainStatus('available');
          setDomainMessage('This domain is available');
        } else {
          setDomainStatus('taken');
          setDomainMessage(result.error || 'This domain is already registered');
        }
      } catch {
        setDomainStatus('idle');
        setDomainMessage('Could not verify domain');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [data.customDomain]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Custom Domain</h2>
        <p className="text-gray-400">
          Enter the domain the tenant owns for their smoke shop website. 
          <span className="block mt-1 text-sm">
            The tenant must purchase and configure DNS for their own domain.
          </span>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tenant&apos;s Domain
          </label>
          <div className="relative">
            <input
              type="text"
              value={data.customDomain}
              onChange={(e) => onChange(prev => ({ ...prev, customDomain: e.target.value.toLowerCase() }))}
              placeholder="joessmokeshop.com"
              className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.customDomain ? 'border-red-500' : 
                domainStatus === 'available' ? 'border-green-500' :
                domainStatus === 'taken' ? 'border-red-500' :
                'border-gray-600'
              }`}
            />
            {domainStatus === 'checking' && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
            {domainStatus === 'available' && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-400">
                ✓
              </div>
            )}
            {domainStatus === 'taken' && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-400">
                ✗
              </div>
            )}
          </div>
          {domainMessage && (
            <p className={`mt-1 text-sm ${
              domainStatus === 'available' ? 'text-green-400' : 
              domainStatus === 'taken' ? 'text-red-400' : 
              'text-gray-500'
            }`}>
              {domainMessage}
            </p>
          )}
          {errors.customDomain && (
            <p className="mt-1 text-sm text-red-400">{errors.customDomain}</p>
          )}
        </div>

        {/* Domain Setup Instructions */}
        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 mt-6">
          <h3 className="font-medium text-white mb-2">📋 Domain Setup Instructions</h3>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
            <li>Tenant purchases their domain from any registrar (GoDaddy, Namecheap, etc.)</li>
            <li>Add a CNAME record pointing to <code className="bg-gray-800 px-1 rounded">app.yourplatform.com</code></li>
            <li>Wait for DNS propagation (usually 1-24 hours)</li>
            <li>The platform will automatically detect and route requests</li>
          </ol>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-400">
            <strong>Note:</strong> Domain is optional at creation. Tenants can access their dashboard 
            via their slug while setting up their custom domain.
          </p>
        </div>
      </div>
    </div>
  );
}

function DatabaseStep({ data, onChange, errors = {} }: StepProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const testConnection = async () => {
    if (!data.dbHost || !data.dbPassword) {
      setTestStatus('error');
      setTestMessage('Please fill in host and password first');
      return;
    }

    setTestStatus('testing');
    setTestMessage('');

    try {
      const response = await fetch('/api/platform/tenants/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbHost: data.dbHost,
          dbName: data.dbName,
          dbUser: data.dbUser,
          dbPassword: data.dbPassword,
          dbPort: data.dbPort,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTestStatus('success');
        setTestMessage('Connection successful!');
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Connection failed');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Failed to test connection');
    }
  };

  // Auto-fill Supabase URL from host
  useEffect(() => {
    if (data.dbHost && data.dbHost.includes('.supabase.co')) {
      const projectId = data.dbHost.split('.')[0].replace('db.', '');
      if (projectId && !data.supabaseProjectId) {
        onChange(prev => ({
          ...prev,
          supabaseProjectId: projectId,
          supabaseUrl: `https://${projectId}.supabase.co`,
        }));
      }
    }
  }, [data.dbHost, data.supabaseProjectId, onChange]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Database Configuration</h2>
        <p className="text-gray-400">
          Enter the Supabase PostgreSQL credentials for this tenant&apos;s isolated database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Database Host *
          </label>
          <input
            type="text"
            value={data.dbHost}
            onChange={(e) => onChange(prev => ({ ...prev, dbHost: e.target.value }))}
            placeholder="db.xyz123abc.supabase.co"
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.dbHost ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          {errors.dbHost && <p className="mt-1 text-sm text-red-400">{errors.dbHost}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Database Name
          </label>
          <input
            type="text"
            value={data.dbName}
            onChange={(e) => onChange(prev => ({ ...prev, dbName: e.target.value }))}
            placeholder="postgres"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Database User
          </label>
          <input
            type="text"
            value={data.dbUser}
            onChange={(e) => onChange(prev => ({ ...prev, dbUser: e.target.value }))}
            placeholder="postgres"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Database Password *
          </label>
          <input
            type="password"
            value={data.dbPassword}
            onChange={(e) => onChange(prev => ({ ...prev, dbPassword: e.target.value }))}
            placeholder="••••••••"
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.dbPassword ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          {errors.dbPassword && <p className="mt-1 text-sm text-red-400">{errors.dbPassword}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Database Port
          </label>
          <input
            type="number"
            value={data.dbPort}
            onChange={(e) => onChange(prev => ({ ...prev, dbPort: parseInt(e.target.value) || 5432 }))}
            placeholder="5432"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Test Connection Button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={testConnection}
          disabled={testStatus === 'testing'}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg border border-gray-600 disabled:opacity-50 transition-colors"
        >
          {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
        </button>
        {testMessage && (
          <span className={`text-sm ${
            testStatus === 'success' ? 'text-green-400' : 'text-red-400'
          }`}>
            {testMessage}
          </span>
        )}
      </div>

      {/* Supabase Metadata (Optional) */}
      <div className="border-t border-gray-700 pt-4 mt-4">
        <h3 className="text-lg font-medium text-white mb-3">Supabase Metadata (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project ID
            </label>
            <input
              type="text"
              value={data.supabaseProjectId}
              onChange={(e) => onChange(prev => ({ ...prev, supabaseProjectId: e.target.value }))}
              placeholder="xyz123abc"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Supabase URL
            </label>
            <input
              type="text"
              value={data.supabaseUrl}
              onChange={(e) => onChange(prev => ({ ...prev, supabaseUrl: e.target.value }))}
              placeholder="https://xyz123abc.supabase.co"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminUserStep({ data, onChange, errors = {} }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Admin User</h2>
        <p className="text-gray-400">Create the owner/admin account for this tenant.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Owner Name *
          </label>
          <input
            type="text"
            value={data.ownerName}
            onChange={(e) => onChange(prev => ({ ...prev, ownerName: e.target.value }))}
            placeholder="Joe Smith"
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.ownerName ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          {errors.ownerName && <p className="mt-1 text-sm text-red-400">{errors.ownerName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Owner Email *
          </label>
          <input
            type="email"
            value={data.ownerEmail}
            onChange={(e) => onChange(prev => ({ ...prev, ownerEmail: e.target.value }))}
            placeholder="joe@joessmokeshop.com"
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.ownerEmail ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          {errors.ownerEmail && <p className="mt-1 text-sm text-red-400">{errors.ownerEmail}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Password *
          </label>
          <input
            type="password"
            value={data.ownerPassword}
            onChange={(e) => onChange(prev => ({ ...prev, ownerPassword: e.target.value }))}
            placeholder="••••••••"
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.ownerPassword ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
          {errors.ownerPassword && <p className="mt-1 text-sm text-red-400">{errors.ownerPassword}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={data.ownerPhone}
            onChange={(e) => onChange(prev => ({ ...prev, ownerPhone: e.target.value }))}
            placeholder="(512) 555-1234"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ data }: { data: TenantFormData }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Review & Confirm</h2>
        <p className="text-gray-400">Please review the tenant details before creating.</p>
      </div>

      <div className="space-y-4">
        {/* Business Info */}
        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
          <h3 className="font-medium text-white mb-3">Business Information</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-400">Business Name:</dt>
            <dd className="text-white">{data.businessName}</dd>
            <dt className="text-gray-400">Slug:</dt>
            <dd className="text-white font-mono">{data.slug}</dd>
            <dt className="text-gray-400">Industry:</dt>
            <dd className="text-white capitalize">{data.industry.replace('-', ' ')}</dd>
            <dt className="text-gray-400">Plan:</dt>
            <dd className="text-white capitalize">{data.planId}</dd>
          </dl>
        </div>

        {/* Domain */}
        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
          <h3 className="font-medium text-white mb-3">Domain</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-400">Custom Domain:</dt>
            <dd className="text-white">{data.customDomain || <span className="text-gray-500 italic">Not configured</span>}</dd>
          </dl>
        </div>

        {/* Database */}
        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
          <h3 className="font-medium text-white mb-3">Database</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-400">Host:</dt>
            <dd className="text-white font-mono text-xs">{data.dbHost}</dd>
            <dt className="text-gray-400">Database:</dt>
            <dd className="text-white">{data.dbName}</dd>
            <dt className="text-gray-400">User:</dt>
            <dd className="text-white">{data.dbUser}</dd>
            <dt className="text-gray-400">Port:</dt>
            <dd className="text-white">{data.dbPort}</dd>
          </dl>
        </div>

        {/* Admin User */}
        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
          <h3 className="font-medium text-white mb-3">Admin User</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-400">Name:</dt>
            <dd className="text-white">{data.ownerName}</dd>
            <dt className="text-gray-400">Email:</dt>
            <dd className="text-white">{data.ownerEmail}</dd>
            <dt className="text-gray-400">Phone:</dt>
            <dd className="text-white">{data.ownerPhone || <span className="text-gray-500 italic">Not provided</span>}</dd>
          </dl>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <p className="text-sm text-yellow-400">
          <strong>⚠️ Important:</strong> This will create a new tenant with an isolated database. 
          The tenant owner will receive their login credentials to access their dashboard.
        </p>
      </div>
    </div>
  );
}
