'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantProvisioningProgress, { ProvisioningStep } from './TenantProvisioningProgress';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';

type WizardStep = 'business' | 'database' | 'admin' | 'provisioning';

interface FormData {
  // Business Info
  businessName: string;
  slug: string;
  customDomain: string;
  
  // Database Config
  supabaseProjectId: string;
  dbPassword: string;
  
  // Admin User
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

export default function SimplifiedTenantWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('business');
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    slug: '',
    customDomain: '',
    supabaseProjectId: '',
    dbPassword: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerPhone: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidatingDomain, setIsValidatingDomain] = useState(false);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  
  // Provisioning state
  const [provisioningSteps, setProvisioningSteps] = useState<ProvisioningStep[]>([]);
  const [provisioningStatus, setProvisioningStatus] = useState<'in-progress' | 'success' | 'error'>('in-progress');

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-generate slug from business name
      if (field === 'businessName') {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateBusinessStep = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }

    // Validate domain if provided
    if (formData.customDomain) {
      setIsValidatingDomain(true);
      try {
        const res = await fetch('/api/platform/tenants/check-domain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: formData.customDomain }),
        });
        const data = await res.json();
        if (!data.available) {
          newErrors.customDomain = data.error || 'Domain is not available';
          setDomainAvailable(false);
        } else {
          setDomainAvailable(true);
        }
      } catch {
        newErrors.customDomain = 'Failed to validate domain';
      }
      setIsValidatingDomain(false);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateDatabaseStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.supabaseProjectId.trim()) {
      newErrors.supabaseProjectId = 'Supabase Project ID is required';
    }
    if (!formData.dbPassword.trim()) {
      newErrors.dbPassword = 'Database password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAdminStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required';
    }
    if (!formData.ownerEmail.trim()) {
      newErrors.ownerEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      newErrors.ownerEmail = 'Invalid email format';
    }
    if (!formData.ownerPassword) {
      newErrors.ownerPassword = 'Password is required';
    } else if (formData.ownerPassword.length < 8) {
      newErrors.ownerPassword = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (currentStep === 'business') {
      if (await validateBusinessStep()) {
        setCurrentStep('database');
      }
    } else if (currentStep === 'database') {
      if (validateDatabaseStep()) {
        setCurrentStep('admin');
      }
    } else if (currentStep === 'admin') {
      if (validateAdminStep()) {
        startProvisioning();
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 'database') setCurrentStep('business');
    else if (currentStep === 'admin') setCurrentStep('database');
  };

  const startProvisioning = async () => {
    setCurrentStep('provisioning');
    
    // Initialize steps
    const steps: ProvisioningStep[] = [
      { id: 'validate', name: 'Validate Configuration', description: 'Checking for conflicts and validating settings', status: 'pending' },
      { id: 'test-db', name: 'Test Database Connection', description: 'Connecting to the tenant database', status: 'pending' },
      { id: 'create-tenant', name: 'Create Tenant Record', description: 'Registering tenant in master database', status: 'pending' },
      { id: 'migrate-db', name: 'Run Database Migrations', description: 'Creating tables in tenant database', status: 'pending' },
      { id: 'create-admin', name: 'Create Admin User', description: 'Setting up tenant admin account', status: 'pending' },
      { id: 'setup-mongodb', name: 'Setup Product Catalog', description: 'Initializing MongoDB product database', status: 'pending' },
      { id: 'activate', name: 'Activate Tenant', description: 'Finalizing tenant setup', status: 'pending' },
    ];
    setProvisioningSteps(steps);
    setProvisioningStatus('in-progress');

    // Animate steps starting
    const animateStep = (index: number) => {
      setProvisioningSteps(prev => prev.map((s, i) => 
        i === index ? { ...s, status: 'in-progress' } : s
      ));
    };

    // Start provisioning request
    try {
      // Animate first step
      animateStep(0);
      
      const response = await fetch('/api/platform/tenants/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formData.businessName,
          slug: formData.slug,
          customDomain: formData.customDomain || undefined,
          dbHost: `db.${formData.supabaseProjectId}.supabase.co`,
          dbName: 'postgres',
          dbUser: 'postgres',
          dbPassword: formData.dbPassword,
          dbPort: 5432,
          supabaseProjectId: formData.supabaseProjectId,
          ownerName: formData.ownerName,
          ownerEmail: formData.ownerEmail,
          ownerPassword: formData.ownerPassword,
          ownerPhone: formData.ownerPhone || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update all steps to success
        setProvisioningSteps(result.steps || steps.map(s => ({ ...s, status: 'success' as const })));
        setProvisioningStatus('success');
      } else {
        // Update steps from response
        setProvisioningSteps(result.steps || steps);
        setProvisioningStatus('error');
      }
    } catch (error) {
      setProvisioningSteps(prev => prev.map((s, i) => 
        i === 0 ? { ...s, status: 'error', error: 'Network error. Please try again.' } : s
      ));
      setProvisioningStatus('error');
    }
  };

  const handleRetry = () => {
    startProvisioning();
  };

  const handleComplete = () => {
    router.push('/platform/dashboard');
  };

  // Render provisioning progress
  if (currentStep === 'provisioning') {
    return (
      <TenantProvisioningProgress
        steps={provisioningSteps}
        currentStepId={provisioningSteps.find(s => s.status === 'in-progress')?.id || null}
        overallStatus={provisioningStatus}
        tenantName={formData.businessName}
        onComplete={handleComplete}
        onRetry={handleRetry}
      />
    );
  }

  // Render form steps
  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['business', 'database', 'admin'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold
                ${currentStep === step 
                  ? 'bg-blue-600 text-white' 
                  : ['business', 'database', 'admin'].indexOf(currentStep) > index
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }
              `}>
                {index + 1}
              </div>
              {index < 2 && (
                <div className={`w-24 h-1 mx-2 ${
                  ['business', 'database', 'admin'].indexOf(currentStep) > index
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>Business Info</span>
          <span>Database</span>
          <span>Admin User</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {currentStep === 'business' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Business Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Name *
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => updateField('businessName', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.businessName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Joe's Smoke Shop"
              />
              {errors.businessName && (
                <p className="mt-1 text-sm text-red-600">{errors.businessName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug *
              </label>
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">tenant-</span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => updateField('slug', e.target.value.toLowerCase())}
                  className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.slug ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="joes-smoke-shop"
                />
              </div>
              {errors.slug && (
                <p className="mt-1 text-sm text-red-600">{errors.slug}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                This will be used to identify the tenant internally
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Domain (Optional)
              </label>
              <input
                type="text"
                value={formData.customDomain}
                onChange={(e) => {
                  updateField('customDomain', e.target.value);
                  setDomainAvailable(null);
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.customDomain ? 'border-red-500' : domainAvailable === true ? 'border-green-500' : 'border-gray-300'
                }`}
                placeholder="shop.example.com"
              />
              {errors.customDomain && (
                <p className="mt-1 text-sm text-red-600">{errors.customDomain}</p>
              )}
              {domainAvailable === true && (
                <p className="mt-1 text-sm text-green-600">✓ Domain is available</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                The tenant&apos;s own domain (they will configure DNS to point here)
              </p>
            </div>
          </div>
        )}

        {currentStep === 'database' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Database Configuration</h2>
            <p className="text-gray-600">
              Create a new Supabase project for this tenant and enter the details below.
            </p>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">How to get these details:</h3>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                <li>Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">supabase.com/dashboard</a></li>
                <li>Click &quot;New Project&quot;</li>
                <li>Set a name and password</li>
                <li>Copy the Project ID from the URL (e.g., <code>uxwqhvfbtfrvuvbezrdw</code>)</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supabase Project ID *
              </label>
              <input
                type="text"
                value={formData.supabaseProjectId}
                onChange={(e) => updateField('supabaseProjectId', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.supabaseProjectId ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="uxwqhvfbtfrvuvbezrdw"
              />
              {errors.supabaseProjectId && (
                <p className="mt-1 text-sm text-red-600">{errors.supabaseProjectId}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Found in your Supabase project URL: https://supabase.com/dashboard/project/<strong>[PROJECT_ID]</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database Password *
              </label>
              <input
                type="password"
                value={formData.dbPassword}
                onChange={(e) => updateField('dbPassword', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.dbPassword ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="The password you set when creating the project"
              />
              {errors.dbPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.dbPassword}</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Admin User</h2>
            <p className="text-gray-600">
              Create the initial admin user for this tenant.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => updateField('ownerName', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.ownerName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="John Smith"
              />
              {errors.ownerName && (
                <p className="mt-1 text-sm text-red-600">{errors.ownerName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => updateField('ownerEmail', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.ownerEmail ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="john@example.com"
              />
              {errors.ownerEmail && (
                <p className="mt-1 text-sm text-red-600">{errors.ownerEmail}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                value={formData.ownerPassword}
                onChange={(e) => updateField('ownerPassword', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.ownerPassword ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Min 8 characters"
              />
              {errors.ownerPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.ownerPassword}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone (Optional)
              </label>
              <input
                type="tel"
                value={formData.ownerPhone}
                onChange={(e) => updateField('ownerPhone', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          {currentStep !== 'business' ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              onClick={() => router.push('/platform/dashboard')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={isValidatingDomain}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isValidatingDomain ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating...
              </>
            ) : currentStep === 'admin' ? (
              <>
                Create Tenant
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
