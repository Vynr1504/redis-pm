/**
 * Basic usage example of RedisPoolManager
 * 
 * This example demonstrates:
 * - Pool initializa  console.log('\nReceived SIGINT, shutting down gracefully...');ion
 * - Connection acquisition and release
 * - Error handling
 * - Graceful shutdown
 */

import RedisPoolManager from '../rpm.js';

async function basicExample() {
  console.log('Starting Redis Pool Manager Example');

  // Create pool instance
  const pool = new RedisPoolManager(
    {
      host: 'localhost',
      port: 6379,
      // password: 'your-redis-password', // if needed
      // db: 0, // database number
    },
    {
      maxConnections: 10,
      minConnections: 3,
      connectionTimeout: 5000
    }
  );

  // Listen for pool events
  pool.on('ready', () => {
    console.log('Pool is ready!');
  });

  pool.on('error', (error) => {
    console.error('Pool error:', error.message);
  });

  // Wait for pool to be ready
  await new Promise((resolve) => {
    pool.once('ready', resolve);
  });

  try {
    console.log('\nInitial pool stats:', pool.getStats());

    // Example 1: Simple key-value operations
    console.log('\nPerforming Redis operations...');
    
    const client = await pool.acquireConnection();
    console.log(`📦 Acquired connection: ${client.connectionId}`);

    // Perform Redis operations
    await client.set('example:key', 'Hello, Redis Pool!');
    const value = await client.get('example:key');
    console.log(`📖 Retrieved value: ${value}`);

    // Release connection back to pool
    pool.releaseConnection(client);
    console.log('Released connection back to pool');

    // Example 2: Multiple concurrent operations
    console.log('\nTesting concurrent operations...');
    
    const operations = Array.from({ length: 5 }, async (_, i) => {
      const client = await pool.acquireConnection();
      try {
        await client.set(`concurrent:${i}`, `value-${i}`);
        const result = await client.get(`concurrent:${i}`);
        console.log(`   Operation ${i}: ${result}`);
        return result;
      } finally {
        pool.releaseConnection(client);
      }
    });

    await Promise.all(operations);
    console.log('All concurrent operations completed');

    // Example 3: Pool statistics
    console.log('\nFinal pool stats:', pool.getStats());

    // Example 4: Health check
    console.log('\n🏥 Running health check...');
    await pool.healthCheck();
    console.log('Health check completed');

  } catch (error) {
    console.error('Example failed:', error.message);
  } finally {
    // Cleanup: shutdown the pool
    console.log('\nShutting down pool...');
    await pool.shutdown();
    console.log('Pool shutdown complete');
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  basicExample().catch(console.error);
}