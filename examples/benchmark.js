/**
 * Performance benchmark for RedisPoolManager
 * 
 * This benchmark tests:
 * - Connection acquisition/release performance
 * - Concurrent operation throughp    console.log(`Scaling benchmark completed:`);t
 * - Pool scaling behavior
 * -  console.log('Starting Redis Pool Manager Benchmark');Memory usage patterns
 */

import RedisPoolManager from '../rpm.js';

class Benchmark {
  constructor(config, poolOptions) {
    this.pool = new RedisPoolManager(config, poolOptions);
    this.results = {};
  }

  async waitForReady() {
    return new Promise((resolve) => {
      this.pool.once('ready', resolve);
    });
  }

  async benchmarkAcquisitionSpeed(iterations = 1000) {
    console.log(`\n Benchmarking connection acquisition speed (${iterations} iterations)...`);
    
    const startTime = process.hrtime.bigint();
    const clients = [];

    // Acquire all connections
    for (let i = 0; i < iterations; i++) {
      const client = await this.pool.acquireConnection();
      clients.push(client);
    }

    const midTime = process.hrtime.bigint();

    // Release all connections
    for (const client of clients) {
      this.pool.releaseConnection(client);
    }

    const endTime = process.hrtime.bigint();

    const acquireTime = Number(midTime - startTime) / 1000000; // Convert to ms
    const releaseTime = Number(endTime - midTime) / 1000000;
    const totalTime = Number(endTime - startTime) / 1000000;

    this.results.acquisition = {
      iterations,
      totalTime: totalTime.toFixed(2),
      acquireTime: acquireTime.toFixed(2),
      releaseTime: releaseTime.toFixed(2),
      avgAcquireTime: (acquireTime / iterations).toFixed(4),
      avgReleaseTime: (releaseTime / iterations).toFixed(4),
      throughput: Math.round(iterations / (totalTime / 1000))
    };

    console.log(`Acquisition benchmark completed:`);
    console.log(`   Total time: ${this.results.acquisition.totalTime}ms`);
    console.log(`   Avg acquire: ${this.results.acquisition.avgAcquireTime}ms`);
    console.log(`   Avg release: ${this.results.acquisition.avgReleaseTime}ms`);
    console.log(`   Throughput: ${this.results.acquisition.throughput} ops/sec`);
  }

  async benchmarkConcurrentOperations(concurrency = 100, operationsPerWorker = 10) {
    console.log(`\nBenchmarking concurrent operations (${concurrency} workers, ${operationsPerWorker} ops each)...`);
    
    const totalOperations = concurrency * operationsPerWorker;
    const startTime = process.hrtime.bigint();

    const workers = Array.from({ length: concurrency }, async (_, workerId) => {
      const operations = [];
      
      for (let i = 0; i < operationsPerWorker; i++) {
        const operation = async () => {
          const client = await this.pool.acquireConnection();
          try {
            const key = `bench:${workerId}:${i}`;
            const value = `value-${workerId}-${i}`;
            
            await client.set(key, value);
            const retrieved = await client.get(key);
            await client.del(key);
            
            return retrieved === value;
          } finally {
            this.pool.releaseConnection(client);
          }
        };
        
        operations.push(operation());
      }
      
      return Promise.all(operations);
    });

    const results = await Promise.all(workers);
    const endTime = process.hrtime.bigint();

    const duration = Number(endTime - startTime) / 1000000; // Convert to ms
    const successCount = results.flat().filter(Boolean).length;

    this.results.concurrent = {
      concurrency,
      operationsPerWorker,
      totalOperations,
      successCount,
      failureCount: totalOperations - successCount,
      duration: duration.toFixed(2),
      throughput: Math.round(totalOperations / (duration / 1000)),
      avgLatency: (duration / totalOperations).toFixed(4)
    };

    console.log(`Concurrent benchmark completed:`);
    console.log(`   Total operations: ${this.results.concurrent.totalOperations}`);
    console.log(`   Success rate: ${((successCount / totalOperations) * 100).toFixed(2)}%`);
    console.log(`   Duration: ${this.results.concurrent.duration}ms`);
    console.log(`   Throughput: ${this.results.concurrent.throughput} ops/sec`);
    console.log(`   Avg latency: ${this.results.concurrent.avgLatency}ms`);
  }

  async benchmarkPoolScaling() {
    console.log(`\nBenchmarking pool scaling behavior...`);
    
    const scalingData = [];
    
    // Test different load levels
    const loadLevels = [1, 5, 10, 20, 50];
    
    for (const load of loadLevels) {
      console.log(`   Testing load level: ${load} concurrent operations`);
      
      const startTime = process.hrtime.bigint();
      const startStats = this.pool.getStats();
      
      // Run concurrent operations
      const operations = Array.from({ length: load }, async (_, i) => {
        const client = await this.pool.acquireConnection();
        try {
          await client.set(`scaling:${i}`, `load-${load}-${i}`);
          await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
          return await client.get(`scaling:${i}`);
        } finally {
          this.pool.releaseConnection(client);
        }
      });
      
      await Promise.all(operations);
      const endTime = process.hrtime.bigint();
      const endStats = this.pool.getStats();
      
      const duration = Number(endTime - startTime) / 1000000;
      
      scalingData.push({
        load,
        duration: duration.toFixed(2),
        connectionsUsed: Math.max(startStats.busy, endStats.busy),
        totalConnections: endStats.total,
        throughput: Math.round(load / (duration / 1000))
      });
    }
    
    this.results.scaling = scalingData;
    
    console.log(` Scaling benchmark completed:`);
    scalingData.forEach(data => {
      console.log(`   Load ${data.load}: ${data.duration}ms, ${data.connectionsUsed} conns, ${data.throughput} ops/sec`);
    });
  }

  async measureMemoryUsage() {
    console.log(`\n Measuring memory usage...`);
    
    const getMemoryUsage = () => {
      const usage = process.memoryUsage();
      return {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024) // MB
      };
    };
    
    const baseline = getMemoryUsage();
    console.log(`   Baseline memory: RSS=${baseline.rss}MB, Heap=${baseline.heapUsed}MB`);
    
    // Create load and measure
    const clients = [];
    for (let i = 0; i < 50; i++) {
      const client = await this.pool.acquireConnection();
      clients.push(client);
    }
    
    const loaded = getMemoryUsage();
    console.log(`   Under load: RSS=${loaded.rss}MB, Heap=${loaded.heapUsed}MB`);
    
    // Release and measure
    for (const client of clients) {
      this.pool.releaseConnection(client);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const afterRelease = getMemoryUsage();
    console.log(`   After release: RSS=${afterRelease.rss}MB, Heap=${afterRelease.heapUsed}MB`);
    
    this.results.memory = {
      baseline,
      loaded,
      afterRelease,
      overhead: {
        rss: loaded.rss - baseline.rss,
        heap: loaded.heapUsed - baseline.heapUsed
      }
    };
  }

  printSummary() {
    console.log(`\nBENCHMARK SUMMARY`);
    console.log(`===================`);
    
    if (this.results.acquisition) {
      console.log(`Connection Acquisition: ${this.results.acquisition.throughput} ops/sec`);
    }
    
    if (this.results.concurrent) {
      console.log(`Concurrent Operations: ${this.results.concurrent.throughput} ops/sec`);
      console.log(`Success Rate: ${((this.results.concurrent.successCount / this.results.concurrent.totalOperations) * 100).toFixed(2)}%`);
    }
    
    if (this.results.memory) {
      console.log(`Memory Overhead: ${this.results.memory.overhead.heap}MB heap, ${this.results.memory.overhead.rss}MB RSS`);
    }
    
    console.log(`Pool Configuration: max=${this.pool.maxConnections}, min=${this.pool.minConnections}`);
    console.log(`Final Stats:`, this.pool.getStats());
  }

  async cleanup() {
    await this.pool.shutdown();
  }
}

async function runBenchmark() {
  console.log(' Starting Redis Pool Manager Benchmark');
  console.log('=========================================');

  const benchmark = new Benchmark(
    {
      host: 'localhost',
      port: 6379,
    },
    {
      maxConnections: 25,
      minConnections: 5,
      connectionTimeout: 5000
    }
  );

  try {
    await benchmark.waitForReady();
    
    await benchmark.benchmarkAcquisitionSpeed(1000);
    await benchmark.benchmarkConcurrentOperations(50, 20);
    await benchmark.benchmarkPoolScaling();
    await benchmark.measureMemoryUsage();
    
    benchmark.printSummary();
    
  } catch (error) {
    console.error(' Benchmark failed:', error.message);
  } finally {
    await benchmark.cleanup();
  }
}

// Run benchmark
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark().catch(console.error);
}