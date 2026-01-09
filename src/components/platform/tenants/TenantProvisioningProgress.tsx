'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

export type ProvisioningStep = {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'success' | 'error';
  error?: string;
};

interface TenantProvisioningProgressProps {
  steps: ProvisioningStep[];
  currentStepId: string | null;
  overallStatus: 'in-progress' | 'success' | 'error';
  tenantName: string;
  onComplete?: () => void;
  onRetry?: () => void;
}

export default function TenantProvisioningProgress({
  steps,
  currentStepId,
  overallStatus,
  tenantName,
  onComplete,
  onRetry,
}: TenantProvisioningProgressProps) {
  const getStepIcon = (step: ProvisioningStep) => {
    switch (step.status) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'in-progress':
        return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      default:
        return <div className="w-6 h-6 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStepClassName = (step: ProvisioningStep) => {
    switch (step.status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'in-progress':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {overallStatus === 'success' 
            ? '🎉 Tenant Created Successfully!' 
            : overallStatus === 'error'
            ? '❌ Provisioning Failed'
            : `Creating ${tenantName}...`}
        </h2>
        <p className="text-gray-600">
          {overallStatus === 'success'
            ? 'The tenant is now ready to use.'
            : overallStatus === 'error'
            ? 'There was an error during provisioning. Please check the details below.'
            : 'Please wait while we set up the tenant environment.'}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="space-y-4 mb-8">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`p-4 rounded-lg border-2 transition-all duration-300 ${getStepClassName(step)}`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                {getStepIcon(step)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">
                    Step {index + 1}
                  </span>
                  {step.status === 'in-progress' && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      In Progress
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">{step.name}</h3>
                <p className="text-sm text-gray-600">{step.description}</p>
                {step.error && (
                  <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{step.error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        {overallStatus === 'success' && (
          <>
            <button
              onClick={onComplete}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Go to Dashboard
            </button>
          </>
        )}
        {overallStatus === 'error' && (
          <>
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Retry
            </button>
            <button
              onClick={onComplete}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>

      {/* Overall Progress Bar */}
      {overallStatus === 'in-progress' && (
        <div className="mt-8">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ 
                width: `${(steps.filter(s => s.status === 'success').length / steps.length) * 100}%` 
              }}
            />
          </div>
          <p className="text-center text-sm text-gray-500 mt-2">
            {steps.filter(s => s.status === 'success').length} of {steps.length} steps completed
          </p>
        </div>
      )}
    </div>
  );
}
