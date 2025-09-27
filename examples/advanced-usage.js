/**
 * Advanced usage example with monitoring and error handling
 * 
 * This example demonstrates:
 * - Pool monitoring with periodic statistics
 *     console.log('Batch results:', batchResults); Health checks scheduling
 * - Advanced error handling patterns
 * - Production-ready patterns
 */

import RedisPoolManager from '../rpm.js';

class RedisService {
  constructor(config, options = {}) {
    this.pool = new RedisPoolManager(config, options);
    this.monitoringInterval = null;
    this.healthCheckInterval = null;
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.pool.on('ready', () => {
      console.log('Redis pool is ready');
      this.startMonitoring();
    });

    this.pool.on('error', (error) => {
      console.error(' Pool error:', error.message);
      // In production, you might want to send this to your monitoring system
    });
  }

  startMonitoring() {
    // Monitor pool statistics every 10 seconds
    this.monitoringInterval = setInterval(() => {
      const stats = this.pool.getStats();
      console.log(`Pool Stats - Available: ${stats.available}, Busy: ${stats.busy}, Errors: ${stats.errors}`);
    }, 10000);

    // Run health checks every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.pool.healthCheck();
        console.log('Health check completed');
      } catch (error) {
        console.error(' Health check failed:', error.message);
      }
    }, 30000);
  }

  /**
   * Safe Redis operation wrapper with automatic connection management
   */
  async safeOperation(operation, retries = 3) {
    let client;
    let attempt = 0;

    while (attempt < retries) {
      try {
        client = await this.pool.acquireConnection();
        const result = await operation(client);
        return result;
      } catch (error) {
        attempt++;
        console.error(` Operation failed (attempt ${attempt}/${retries}):`, error.message);
        
        if (attempt >= retries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } finally {
        if (client) {
          this.pool.releaseConnection(client);
          client = null;
        }
      }
    }
  }

  /**
   * Batch operations with connection reuse
   */
  async batchOperations(operations) {
    const client = await this.pool.acquireConnection();
    try {
      const results = [];
      for (const operation of operations) {
        const result = await operation(client);
        results.push(result);
      }
      return results;
    } finally {
      this.pool.releaseConnection(client);
    }
  }

  async shutdown() {
    console.log('Shutting down Redis service...');
    
    // Clear monitoring intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown the pool
    await this.pool.shutdown();
    console.log('Redis service shutdown complete');
  }
}

async function advancedExample() {
  console.log('Starting Advanced Redis Pool Example');

  const redisService = new RedisService(
    {
      host: 'localhost',
      port: 6379,
    },
    {
      maxConnections: 20,
      minConnections: 5,
      connectionTimeout: 5000
    }
  );

  // Wait for service to be ready
  await new Promise((resolve) => {
    redisService.pool.once('ready', resolve);
  });

  try {
    // Example 1: Safe operation with retries
    console.log('\n Testing safe operation with retries...');
    const value = await redisService.safeOperation(async (client) => {
      await client.set('safe:operation', 'success');
      return await client.get('safe:operation');
    });
    console.log('Safe operation result:', value);

    // Example 2: Batch operations
    console.log('\n Testing batch operations...');
    const batchResults = await redisService.batchOperations([
      (client) => client.set('batch:1', 'first'),
      (client) => client.set('batch:2', 'second'),
      (client) => client.set('batch:3', 'third'),
      (client) => client.mget('batch:1', 'batch:2', 'batch:3')
    ]);
    console.log(' Batch results:', batchResults);

    // Example 3: Concurrent operations stress test
    console.log('\n Running concurrent operations stress test...');
    const concurrentOps = Array.from({ length: 50 }, async (_, i) => {
      return redisService.safeOperation(async (client) => {
        await client.set(`stress:${i}`, `value-${i}`);
        await client.expire(`stress:${i}`, 60); // Expire in 60 seconds
        return await client.get(`stress:${i}`);
      });
    });

    const startTime = Date.now();
    const results = await Promise.all(concurrentOps);
    const duration = Date.now() - startTime;
    
    console.log(`Completed ${results.length} operations in ${duration}ms`);
    console.log(`Average: ${(duration / results.length).toFixed(2)}ms per operation`);

    // Let monitoring run for a bit
    console.log('\n Running monitoring for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Advanced example failed:', error.message);
  } finally {
    await redisService.shutdown();
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  advancedExample().catch(console.error);
}
