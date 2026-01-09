/**
 * Standalone Saga Pattern Tests (No Database Required)
 * 
 * Tests saga orchestration, compensation, and retry logic using in-memory state.
 * Run with: npx tsx src/lib/transactions/__tests__/saga-standalone.test.ts
 */

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

async function test(name: string, fn: () => Promise<void>) {
  testsRun++;
  try {
    await fn();
    testsPassed++;
    console.log(`${GREEN}✓${RESET} ${name}`);
  } catch (error) {
    testsFailed++;
    console.log(`${RED}✗${RESET} ${name}`);
    console.error(`  ${RED}Error: ${error.message}${RESET}`);
    if (error.stack) {
      console.error(`  ${error.stack.split('\n').slice(1, 4).join('\n  ')}`);
    }
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message || 
      `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Mock Saga Implementation (Simplified)
type SagaStepFn<T> = (context: T) => Promise<any>;

interface SagaStep<T> {
  name: string;
  execute: SagaStepFn<T>;
  compensate?: (context: T, result: any) => Promise<void>;
  retryConfig?: {
    maxAttempts: number;
    delayMs: number;
  };
}

interface SagaContext {
  data: Record<string, any>;
  input?: any;
}

class SimpleSaga<T extends SagaContext> {
  private steps: SagaStep<T>[] = [];
  private executedSteps: Array<{ step: SagaStep<T>; result: any }> = [];
  public sagaId: string;
  public context: T;

  constructor(sagaId: string, initialContext: Partial<T>) {
    this.sagaId = sagaId;
    this.context = { data: {}, ...initialContext } as T;
  }

  addStep(step: SagaStep<T>): this {
    this.steps.push(step);
    return this;
  }

  async execute(): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Execute steps sequentially
      for (const step of this.steps) {
        const result = await this.executeStepWithRetry(step);
        this.executedSteps.push({ step, result });
        this.context.data[step.name] = result;
      }
      return { success: true, result: this.context.data };
    } catch (error) {
      // Compensation on failure
      await this.compensate();
      return { success: false, error: error.message };
    }
  }

  private async executeStepWithRetry(step: SagaStep<T>): Promise<any> {
    const maxAttempts = step.retryConfig?.maxAttempts || 1;
    const delayMs = step.retryConfig?.delayMs || 0;
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await step.execute(this.context);
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    throw lastError;
  }

  private async compensate(): Promise<void> {
    // Compensate in reverse order (LIFO)
    const reversedSteps = [...this.executedSteps].reverse();
    
    for (const { step, result } of reversedSteps) {
      if (step.compensate) {
        try {
          await step.compensate(this.context, result);
        } catch (error) {
          console.error(`Compensation failed for ${step.name}:`, error.message);
        }
      }
    }
  }
}

// In-memory state for tests
const state = {
  records: new Map<string, any>(),
  operations: [] as string[],
};

function resetState() {
  state.records.clear();
  state.operations = [];
}

// Test Suite
async function runTests() {
  console.log(`\n${BLUE}Running Saga Pattern Tests${RESET}\n`);

  // Test 1: All steps succeed
  await test('All steps succeed - executes all steps in order', async () => {
    resetState();
    
    const saga = new SimpleSaga('saga-1', { input: 'test' });
    
    saga.addStep({
      name: 'step1',
      execute: async (ctx) => {
        state.operations.push('step1-execute');
        return 'result1';
      },
    });
    
    saga.addStep({
      name: 'step2',
      execute: async (ctx) => {
        state.operations.push('step2-execute');
        return 'result2';
      },
    });
    
    const result = await saga.execute();
    
    assertTrue(result.success, 'Saga should succeed');
    assertEqual(state.operations, ['step1-execute', 'step2-execute']);
    assertEqual(result.result?.step1, 'result1');
    assertEqual(result.result?.step2, 'result2');
  });

  // Test 2: Failure triggers compensation
  await test('Failure in step 2 triggers compensation of step 1', async () => {
    resetState();
    
    const saga = new SimpleSaga('saga-2', { input: 'test' });
    
    saga.addStep({
      name: 'step1',
      execute: async (ctx) => {
        state.operations.push('step1-execute');
        state.records.set('record1', { id: 1 });
        return { id: 1 };
      },
      compensate: async (ctx, result) => {
        state.operations.push('step1-compensate');
        state.records.delete('record1');
      },
    });
    
    saga.addStep({
      name: 'step2',
      execute: async (ctx) => {
        state.operations.push('step2-execute');
        throw new Error('Step 2 failed');
      },
      compensate: async (ctx, result) => {
        state.operations.push('step2-compensate');
      },
    });
    
    const result = await saga.execute();
    
    assertTrue(!result.success, 'Saga should fail');
    assertEqual(
      state.operations, 
      ['step1-execute', 'step2-execute', 'step1-compensate']
    );
    assertTrue(!state.records.has('record1'), 'Record should be cleaned up');
  });

  // Test 3: Compensation happens in reverse order
  await test('Compensation happens in reverse order (LIFO)', async () => {
    resetState();
    
    const saga = new SimpleSaga('saga-3', { input: 'test' });
    
    saga.addStep({
      name: 'step1',
      execute: async (ctx) => {
        state.operations.push('step1-execute');
        return 1;
      },
      compensate: async (ctx, result) => {
        state.operations.push('step1-compensate');
      },
    });
    
    saga.addStep({
      name: 'step2',
      execute: async (ctx) => {
        state.operations.push('step2-execute');
        return 2;
      },
      compensate: async (ctx, result) => {
        state.operations.push('step2-compensate');
      },
    });
    
    saga.addStep({
      name: 'step3',
      execute: async (ctx) => {
        state.operations.push('step3-execute');
        throw new Error('Step 3 failed');
      },
      compensate: async (ctx, result) => {
        state.operations.push('step3-compensate');
      },
    });
    
    await saga.execute();
    
    // Should compensate in order: step2, step1 (reverse of execution)
    assertEqual(
      state.operations,
      [
        'step1-execute',
        'step2-execute', 
        'step3-execute',
        'step2-compensate',
        'step1-compensate',
      ]
    );
  });

  // Test 4: Retry logic works
  await test('Retry logic recovers from transient failures', async () => {
    resetState();
    
    let attemptCount = 0;
    
    const saga = new SimpleSaga('saga-4', { input: 'test' });
    
    saga.addStep({
      name: 'flaky-step',
      execute: async (ctx) => {
        attemptCount++;
        state.operations.push(`attempt-${attemptCount}`);
        if (attemptCount < 3) {
          throw new Error('Transient failure');
        }
        return 'success';
      },
      retryConfig: {
        maxAttempts: 3,
        delayMs: 10,
      },
    });
    
    const result = await saga.execute();
    
    assertTrue(result.success, 'Saga should succeed after retries');
    assertEqual(attemptCount, 3, 'Should retry exactly 3 times');
    assertEqual(state.operations, ['attempt-1', 'attempt-2', 'attempt-3']);
  });

  // Test 5: Retry exhaustion causes failure
  await test('Exhausting retries triggers compensation', async () => {
    resetState();
    
    let attemptCount = 0;
    
    const saga = new SimpleSaga('saga-5', { input: 'test' });
    
    saga.addStep({
      name: 'step1',
      execute: async (ctx) => {
        state.operations.push('step1-execute');
        return 1;
      },
      compensate: async (ctx, result) => {
        state.operations.push('step1-compensate');
      },
    });
    
    saga.addStep({
      name: 'always-fails',
      execute: async (ctx) => {
        attemptCount++;
        state.operations.push(`fail-attempt-${attemptCount}`);
        throw new Error('Permanent failure');
      },
      retryConfig: {
        maxAttempts: 2,
        delayMs: 5,
      },
      compensate: async (ctx, result) => {
        state.operations.push('fail-compensate');
      },
    });
    
    const result = await saga.execute();
    
    assertTrue(!result.success, 'Saga should fail after exhausting retries');
    assertEqual(attemptCount, 2, 'Should attempt exactly 2 times');
    assertEqual(
      state.operations,
      ['step1-execute', 'fail-attempt-1', 'fail-attempt-2', 'step1-compensate']
    );
  });

  // Test 6: Context data passes between steps
  await test('Context data passes correctly between steps', async () => {
    resetState();
    
    const saga = new SimpleSaga('saga-6', { input: { userId: 123 } });
    
    saga.addStep({
      name: 'create-user',
      execute: async (ctx) => {
        assertTrue(ctx.input.userId === 123, 'Should receive input');
        ctx.data.userId = ctx.input.userId;
        ctx.data.userName = 'John Doe';
        return { userId: ctx.input.userId, userName: 'John Doe' };
      },
    });
    
    saga.addStep({
      name: 'create-profile',
      execute: async (ctx) => {
        assertTrue(ctx.data.userId === 123, 'Should access previous step data');
        assertTrue(ctx.data.userName === 'John Doe', 'Should access user name');
        return { profileId: 456 };
      },
    });
    
    const result = await saga.execute();
    
    assertTrue(result.success, 'Saga should succeed');
    assertEqual(result.result?.userId, 123);
    assertEqual(result.result?.userName, 'John Doe');
    assertEqual(result.result?.['create-profile']?.profileId, 456);
  });

  // Test 7: Steps without compensate are skipped
  await test('Steps without compensate function are skipped during rollback', async () => {
    resetState();
    
    const saga = new SimpleSaga('saga-7', { input: 'test' });
    
    saga.addStep({
      name: 'step1',
      execute: async (ctx) => {
        state.operations.push('step1-execute');
        return 1;
      },
      compensate: async (ctx, result) => {
        state.operations.push('step1-compensate');
      },
    });
    
    saga.addStep({
      name: 'step2-no-compensate',
      execute: async (ctx) => {
        state.operations.push('step2-execute');
        return 2;
      },
      // No compensate function
    });
    
    saga.addStep({
      name: 'step3',
      execute: async (ctx) => {
        state.operations.push('step3-execute');
        throw new Error('Failure');
      },
    });
    
    await saga.execute();
    
    // Should only compensate step1 (step2 has no compensate)
    assertEqual(
      state.operations,
      ['step1-execute', 'step2-execute', 'step3-execute', 'step1-compensate']
    );
  });

  // Summary
  console.log(`\n${BLUE}════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}Test Summary${RESET}`);
  console.log(`${BLUE}════════════════════════════════════════${RESET}`);
  console.log(`Tests Run: ${testsRun}`);
  console.log(`${GREEN}Passed: ${testsPassed}${RESET}`);
  console.log(`${RED}Failed: ${testsFailed}${RESET}`);
  console.log(`Success Rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log(`\n${GREEN}✓ All tests passed!${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`\n${RED}✗ Some tests failed${RESET}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${RED}Fatal error running tests:${RESET}`, error);
  process.exit(1);
});
