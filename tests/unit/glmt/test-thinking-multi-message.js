#!/usr/bin/env node
'use strict';

/**
 * Test Script: Multi-message thinking block behavior
 *
 * Simulates 3 consecutive messages to test if thinking blocks
 * appear in all messages or only the first one.
 *
 * Usage: CCS_DEBUG=1 node test-thinking-multi-message.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ccsPath = path.join(__dirname, 'bin', 'ccs.js');
const logDir = path.join(require('os').homedir(), '.ccs', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

console.log('='.repeat(60));
console.log('GLMT Multi-Message Thinking Block Test');
console.log('='.repeat(60));
console.log('');
console.log('Test scenario: 3 consecutive messages with thinking enabled');
console.log('Expected: Thinking blocks appear in ALL 3 messages');
console.log('Actual: User reports thinking only in first message');
console.log('');
console.log('Log directory:', logDir);
console.log('');

// Test messages
const messages = [
  'Message 1: Calculate 15! (factorial)',
  'Message 2: What is the square root of 2 to 10 decimal places?',
  'Message 3: Explain the Pythagorean theorem',
];

// Track results
const results = {
  message1: { thinking: false, error: null },
  message2: { thinking: false, error: null },
  message3: { thinking: false, error: null },
};

async function runMessage(messageIndex) {
  const message = messages[messageIndex];
  const messageKey = `message${messageIndex + 1}`;

  console.log('-'.repeat(60));
  console.log(`Testing Message ${messageIndex + 1}/${messages.length}`);
  console.log(`Prompt: "${message}"`);
  console.log('-'.repeat(60));

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Clear old logs for this test
    const beforeFiles = fs.readdirSync(logDir).filter((f) => f.endsWith('.json'));

    // Use process.execPath for Windows compatibility (CVE-2024-27980)
    const child = spawn(process.execPath, [ccsPath, 'glmt', '--verbose', message], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CCS_DEBUG: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;

      // Check for thinking indicator
      if (text.includes('∴ Thinking') || text.includes('Thinking…')) {
        results[messageKey].thinking = true;
        console.log('[✓] Thinking block detected in stdout');
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;

      console.log('');
      console.log(`Process exited with code ${code} after ${duration}ms`);

      // Check logs
      const afterFiles = fs.readdirSync(logDir).filter((f) => f.endsWith('.json'));
      const newFiles = afterFiles.filter((f) => !beforeFiles.includes(f));

      console.log(`New log files: ${newFiles.length}`);

      // Check for reasoning_content in response logs
      const responseFiles = newFiles.filter((f) => f.includes('response-openai'));
      console.log(`Response log files: ${responseFiles.length}`);

      if (responseFiles.length > 0) {
        const latestResponse = responseFiles.sort().pop();
        const responsePath = path.join(logDir, latestResponse);
        console.log(`Latest response log: ${latestResponse}`);

        try {
          const responseData = JSON.parse(fs.readFileSync(responsePath, 'utf8'));
          const reasoningContent = responseData.choices?.[0]?.message?.reasoning_content;

          if (reasoningContent) {
            const length = reasoningContent.length;
            const lines = reasoningContent.split('\n').length;
            console.log(`[✓] reasoning_content found: ${length} chars, ${lines} lines`);
            results[messageKey].thinking = true;
          } else {
            console.log('[X] No reasoning_content in response');
            results[messageKey].thinking = false;
          }
        } catch (e) {
          console.log(`[!] Error reading response log: ${e.message}`);
          results[messageKey].error = e.message;
        }
      } else {
        console.log('[X] No response logs found');
        results[messageKey].error = 'No response logs';
      }

      console.log('');

      if (code === 0) {
        resolve();
      } else {
        results[messageKey].error = `Exit code ${code}`;
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`[X] Process error: ${error.message}`);
      results[messageKey].error = error.message;
      reject(error);
    });
  });
}

async function main() {
  try {
    // Run messages sequentially
    for (let i = 0; i < messages.length; i++) {
      await runMessage(i);

      // Wait a bit between messages
      if (i < messages.length - 1) {
        console.log('Waiting 2s before next message...');
        console.log('');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Final summary
    console.log('='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));
    console.log('');

    for (let i = 1; i <= 3; i++) {
      const key = `message${i}`;
      const result = results[key];
      const status = result.thinking ? '[✓ PASS]' : '[X FAIL]';
      console.log(`${status} Message ${i}: Thinking = ${result.thinking}`);
      if (result.error) {
        console.log(`         Error: ${result.error}`);
      }
    }

    console.log('');

    const passCount = Object.values(results).filter((r) => r.thinking).length;
    const failCount = 3 - passCount;

    console.log(`Summary: ${passCount}/3 messages showed thinking blocks`);
    console.log('');

    if (failCount > 0) {
      console.log('[!] ISSUE CONFIRMED: Some messages missing thinking blocks');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Analyze request logs to verify reasoning params');
      console.log('  2. Check if transformer is being called correctly');
      console.log('  3. Verify state management (accumulator/parser)');
      console.log('');
      process.exit(1);
    } else {
      console.log('[✓] ALL TESTS PASSED: Thinking blocks appear in all messages');
      console.log('');
      process.exit(0);
    }
  } catch (error) {
    console.error('');
    console.error('[X] Test failed:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();
