/**
 * Saga Pattern Tests
 * 
 * Test suite for saga orchestration and compensation logic
 * Run with: npx tsx src/lib/transactions/__tests__/saga.test.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { Saga, SagaStep } from '@/lib/transactions/saga';

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
    console.log(`  ${RED}${error}${RESET}`);
  }
}

async function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    },
  };
}

async function runTests() {
  console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}🧪 Saga Pattern Test Suite${RESET}`);
  console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  // Test 1: Successful saga execution
  await test('Saga - All steps succeed', async () => {
    const saga = new Saga('test-saga-1', { counter: 0 });
    
    saga.addStep({
      name: 'step1',
      execute: async (context) => {
        context.data.counter += 1;
        return { value: 1 };
      },
    });
    
    saga.addStep({
      name: 'step2',
      execute: async (context) => {
        context.data.counter += 10;
        return { value: 2 };
      },
    });
    
    const result = await saga.execute();
    
    await expect(result.success).toBeTruthy();
    await expect(saga.context.data.counter).toBe(11);
    await expect(saga.context.completedSteps.length).toBe(2);
  });
  
  // Test 2: Saga fails and compensates
  await test('Saga - Failure triggers compensation', async () => {
    const saga = new Saga('test-saga-2', { counter: 0, compensated: [] as string[] });
    
    saga.addStep({
      name: 'step1',
      execute: async (context) => {
        context.data.counter += 1;
        return { value: 1 };
      },
      compensate: async (context) => {
        context.data.compensated.push('step1');
        context.data.counter -= 1;
      },
    });
    
    saga.addStep({
      name: 'step2',
      execute: async (context) => {
        context.data.counter += 10;
        return { value: 2 };
      },
      compensate: async (context) => {
        context.data.compensated.push('step2');
        context.data.counter -= 10;
      },
    });
    
    saga.addStep({
      name: 'step3_fails',
      execute: async (context) => {
        throw new Error('Step 3 failed');
      },
      compensate: async (context) => {
        context.data.compensated.push('step3');
      },
    });
    
    const result = await saga.execute();
    
    await expect(result.success).toBeFalsy();
    await expect(saga.context.completedSteps.length).toBe(2); // Only step1 and step2 completed
    await expect(saga.context.compensatedSteps.length).toBe(2); // Both compensated
    await expect(saga.context.data.counter).toBe(0); // Compensations reversed changes
  });
  
  // Test 3: Compensation happens in reverse order
  await test('Saga - Compensation in reverse order', async () => {
    const saga = new Saga('test-saga-3', { order: [] as string[] });
    
    saga.addStep({
      name: 'first',
      execute: async (context) => {
        context.data.order.push('execute:first');
        return {};
      },
      compensate: async (context) => {
        context.data.order.push('compensate:first');
      },
    });
    
    saga.addStep({
      name: 'second',
      execute: async (context) => {
        context.data.order.push('execute:second');
        return {};
      },
      compensate: async (context) => {
        context.data.order.push('compensate:second');
      },
    });
    
    saga.addStep({
      name: 'third_fails',
      execute: async (context) => {
        context.data.order.push('execute:third');
        throw new Error('Third step failed');
      },
    });
    
    await saga.execute();
    
    // Execution: first, second, third (failed)
    // Compensation: second (last completed), then first
    const expectedOrder = [
      'execute:first',
      'execute:second',
      'execute:third',
      'compensate:second', // Last completed compensated first
      'compensate:first',
    ];
    
    for (let i = 0; i < expectedOrder.length; i++) {
      if (saga.context.data.order[i] !== expectedOrder[i]) {
        throw new Error(`Order mismatch at index ${i}: expected ${expectedOrder[i]}, got ${saga.context.data.order[i]}`);
      }
    }
  });
  
  // Test 4: Retry logic
  await test('Saga - Retry on failure', async () => {
    const saga = new Saga('test-saga-4', { attempts: 0 });
    
    saga.addStep({
      name: 'flaky_step',
      execute: async (context) => {
        context.data.attempts += 1;
        if (context.data.attempts < 3) {
          throw new Error(`Attempt ${context.data.attempts} failed`);
        }
        return { success: true };
      },
      retry: {
        maxAttempts: 3,
        delayMs: 10,
      },
    });
    
    const result = await saga.execute();
    
    await expect(result.success).toBeTruthy();
    await expect(saga.context.data.attempts).toBe(3); // Succeeded on 3rd attempt
  });
  
  // Test 5: Retry exhaustion
  await test('Saga - Retry exhaustion triggers compensation', async () => {
    const saga = new Saga('test-saga-5', { attempts: 0 });
    
    saga.addStep({
      name: 'always_fails',
      execute: async (context) => {
        context.data.attempts += 1;
        throw new Error('Always fails');
      },
      retry: {
        maxAttempts: 3,
        delayMs: 10,
      },
    });
    
    const result = await saga.execute();
    
    await expect(result.success).toBeFalsy();
    await expect(saga.context.data.attempts).toBe(3); // Tried 3 times
  });
  
  // Test 6: Context data passing
  await test('Saga - Context data passes between steps', async () => {
    const saga = new Saga('test-saga-6', {});
    
    saga.addStep({
      name: 'create_user',
      execute: async (context) => {
        const user = { id: '123', name: 'Test User' };
        context.data.userId = user.id;
        return user;
      },
    });
    
    saga.addStep({
      name: 'create_profile',
      execute: async (context) => {
        const profile = { userId: context.data.userId, bio: 'Test bio' };
        return profile;
      },
    });
    
    const result = await saga.execute();
    
    await expect(result.success).toBeTruthy();
    await expect(saga.context.data.userId).toBe('123');
  });
  
  // Test 7: No compensation if no compensate function defined
  await test('Saga - Skips steps without compensate function', async () => {
    const saga = new Saga('test-saga-7', { compensated: 0 });
    
    saga.addStep({
      name: 'step_without_compensate',
      execute: async () => ({ value: 1 }),
      // No compensate function
    });
    
    saga.addStep({
      name: 'failing_step',
      execute: async () => {
        throw new Error('Failed');
      },
    });
    
    const result = await saga.execute();
    
    await expect(result.success).toBeFalsy();
    await expect(saga.context.compensatedSteps.length).toBe(0); // Nothing to compensate
  });
  
  // Print results
  console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BLUE}📊 Test Results${RESET}`);
  console.log(`${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  console.log(`Total Tests: ${testsRun}`);
  console.log(`${GREEN}Passed: ${testsPassed}${RESET}`);
  console.log(`${RED}Failed: ${testsFailed}${RESET}`);
  
  const passRate = testsRun > 0 ? ((testsPassed / testsRun) * 100).toFixed(1) : '0.0';
  console.log(`Pass Rate: ${testsFailed === 0 ? GREEN : RED}${passRate}%${RESET}\n`);
  
  if (testsFailed === 0) {
    console.log(`${GREEN}✅ All tests passed!${RESET}\n`);
  } else {
    console.log(`${RED}❌ Some tests failed. Review errors above.${RESET}\n`);
  }
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`${RED}Fatal error running tests:${RESET}`, error);
  process.exit(1);
});
