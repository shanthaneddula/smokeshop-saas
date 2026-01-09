/**
 * Saga Pattern Implementation for Multi-Step Operations
 * 
 * Implements compensating transactions for distributed operations.
 * When a step fails, all previous steps are automatically rolled back.
 * 
 * Use Cases:
 * - Tenant creation (master DB + tenant DB + user creation)
 * - Payment processing (charge + order + inventory)
 * - Account deletion (soft delete + cleanup + notifications)
 */

import { masterDb } from '@/lib/db/master-db';

/**
 * Saga step result
 */
export interface SagaStepResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Saga step definition
 */
export interface SagaStep<TContext = any, TResult = any> {
  /** Step name for logging */
  name: string;
  
  /** Forward action (what to do) */
  execute: (context: TContext) => Promise<TResult>;
  
  /** Compensating action (how to undo) */
  compensate?: (context: TContext, result?: TResult) => Promise<void>;
  
  /** Whether this step is critical (cannot be skipped) */
  critical?: boolean;
  
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    delayMs: number;
  };
}

/**
 * Saga execution context
 */
export interface SagaContext {
  /** Unique saga execution ID for tracing */
  sagaId: string;
  
  /** Start timestamp */
  startedAt: Date;
  
  /** Custom data passed between steps */
  data: Record<string, any>;
  
  /** Execution results from completed steps */
  completedSteps: Array<{
    name: string;
    result: any;
    timestamp: Date;
  }>;
  
  /** Compensation results */
  compensatedSteps: Array<{
    name: string;
    success: boolean;
    timestamp: Date;
    error?: Error;
  }>;
}

/**
 * Saga orchestrator
 */
export class Saga<TContext = any> {
  private steps: SagaStep<TContext>[] = [];
  private _context: SagaContext;
  
  constructor(sagaId: string, initialData: Record<string, any> = {}) {
    this._context = {
      sagaId,
      startedAt: new Date(),
      data: initialData,
      completedSteps: [],
      compensatedSteps: [],
    };
  }
  
  /**
   * Get the current saga context (read-only access)
   */
  get context(): Readonly<SagaContext> {
    return this._context;
  }
  
  /**
   * Add a step to the saga
   */
  addStep(step: SagaStep<TContext>): this {
    this.steps.push(step);
    return this;
  }
  
  /**
   * Execute saga with automatic compensation on failure
   */
  async execute(): Promise<{ success: boolean; data?: any; error?: Error }> {
    console.log(`[Saga:${this._context.sagaId}] Starting execution with ${this.steps.length} steps`);
    
    let currentStepIndex = 0;
    
    try {
      // Execute steps sequentially
      for (let i = 0; i < this.steps.length; i++) {
        currentStepIndex = i;
        const step = this.steps[i];
        
        console.log(`[Saga:${this.context.sagaId}] Executing step ${i + 1}/${this.steps.length}: ${step.name}`);
        
        // Execute with retry logic
        const result = await this.executeStepWithRetry(step);
        
        // Record completion
        this.context.completedSteps.push({
          name: step.name,
          result,
          timestamp: new Date(),
        });
        
        console.log(`[Saga:${this.context.sagaId}] Step ${step.name} completed successfully`);
      }
      
      // All steps completed successfully
      console.log(`[Saga:${this.context.sagaId}] Saga completed successfully`);
      
      return {
        success: true,
        data: this.context.data,
      };
    } catch (error) {
      // Saga failed - compensate completed steps
      console.error(`[Saga:${this.context.sagaId}] Saga failed at step ${this.steps[currentStepIndex]?.name}:`, error);
      
      await this.compensate();
      
      return {
        success: false,
        error: error as Error,
      };
    }
  }
  
  /**
   * Execute step with retry logic
   */
  private async executeStepWithRetry<T>(step: SagaStep<TContext, T>): Promise<T> {
    const maxAttempts = step.retry?.maxAttempts || 1;
    const delayMs = step.retry?.delayMs || 0;
    
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await step.execute(this.context as any);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[Saga:${this.context.sagaId}] Step ${step.name} attempt ${attempt}/${maxAttempts} failed:`, error);
        
        if (attempt < maxAttempts) {
          console.log(`[Saga:${this.context.sagaId}] Retrying step ${step.name} in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Compensate all completed steps in reverse order
   */
  private async compensate(): Promise<void> {
    console.log(`[Saga:${this.context.sagaId}] Starting compensation for ${this.context.completedSteps.length} completed steps`);
    
    // Compensate in reverse order (undo last step first)
    const stepsToCompensate = [...this.context.completedSteps].reverse();
    
    for (const completedStep of stepsToCompensate) {
      const step = this.steps.find(s => s.name === completedStep.name);
      
      if (!step?.compensate) {
        console.warn(`[Saga:${this.context.sagaId}] No compensation defined for step: ${completedStep.name}`);
        continue;
      }
      
      try {
        console.log(`[Saga:${this.context.sagaId}] Compensating step: ${completedStep.name}`);
        await step.compensate(this.context as any, completedStep.result);
        
        this.context.compensatedSteps.push({
          name: completedStep.name,
          success: true,
          timestamp: new Date(),
        });
        
        console.log(`[Saga:${this.context.sagaId}] Compensated step: ${completedStep.name}`);
      } catch (error) {
        console.error(`[Saga:${this.context.sagaId}] Failed to compensate step ${completedStep.name}:`, error);
        
        this.context.compensatedSteps.push({
          name: completedStep.name,
          success: false,
          timestamp: new Date(),
          error: error as Error,
        });
        
        // Continue compensating other steps even if one fails
      }
    }
    
    console.log(`[Saga:${this.context.sagaId}] Compensation complete. Successful: ${this.context.compensatedSteps.filter(s => s.success).length}/${this.context.compensatedSteps.length}`);
  }
  
  /**
   * Get saga execution summary
   */
  getSummary() {
    return {
      sagaId: this.context.sagaId,
      startedAt: this.context.startedAt,
      completedSteps: this.context.completedSteps.length,
      compensatedSteps: this.context.compensatedSteps.length,
      totalSteps: this.steps.length,
      duration: Date.now() - this.context.startedAt.getTime(),
    };
  }
  
  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Log saga execution to database (for auditing)
 */
export async function logSagaExecution(
  sagaId: string,
  sagaType: string,
  status: 'started' | 'completed' | 'failed' | 'compensated',
  details: Record<string, any>
): Promise<void> {
  try {
    await masterDb.tenantActivityLog.create({
      data: {
        tenantId: details.tenantId || null,
        eventType: `saga_${status}`,
        details: {
          sagaId,
          sagaType,
          status,
          ...details,
        },
      },
    });
  } catch (error) {
    console.error('[Saga] Failed to log saga execution:', error);
    // Don't throw - logging failure shouldn't break saga
  }
}
