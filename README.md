# Redis Pool Manager

[![npm version](https://badge.fury.io/js/redis-pm.svg)](https://badge.fury.io/js/redis-pm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)

A robust and production-ready Redis connection pool manager for Node.js applications. Provides automatic connection scaling, health monitoring, comprehensive error handling, and detailed statistics.

## Features

**Automatic Scaling** - Dynamic connection pool sizing between min/max limits  
**Health Monitoring** - Automatic connection health checks and recovery  
**Error Recovery** - Comprehensive error handling with automatic reconnection  
**Statistics** - Detailed metrics and connection pool analytics  
**High Performance** - Optimized connection acquisition and release  
**Event-Driven** - EventEmitter-based architecture for monitoring  
**Production Ready** - Thoroughly tested and battle-proven  

## Installation

```bash
npm install redis-pm
```

## Quick Start

```javascript
import RedisPoolManager from 'redis-pm';

// Create pool with Redis configuration
const pool = new RedisPoolManager(
  { host: 'localhost', port: 6379 }, // Redis config
  { 
    maxConnections: 20,  // Maximum connections
    minConnections: 5,   // Minimum connections
    connectionTimeout: 5000  // Timeout in ms
  }
);

// Wait for pool initialization
pool.on('ready', () => {
  console.log('Redis pool is ready!');
});

// Handle pool errors
pool.on('error', (error) => {
  console.error('Pool error:', error);
});

// Use the pool
async function example() {
  try {
    const client = await pool.acquireConnection();
    
    // Use Redis client
    await client.set('key', 'value');
    const value = await client.get('key');
    console.log('Value:', value);
    
    // Always release the connection
    pool.releaseConnection(client);
  } catch (error) {
    console.error('Redis operation failed:', error);
  }
}
```

## Configuration

### Redis Configuration
Pass any valid [redis client configuration](https://github.com/redis/node-redis#options-object-properties) as the first parameter:

```javascript
const redisConfig = {
  host: 'localhost',
  port: 6379,
  password: 'your-password',
  db: 0,
  // Any other redis client options...
};
```

### Pool Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxConnections` | `number` | `10` | Maximum number of connections in pool |
| `minConnections` | `number` | `2` | Minimum number of connections to maintain |
| `connectionTimeout` | `number` | `30000` | Timeout (ms) when acquiring connections |
| `retryDelay` | `number` | `1000` | Delay (ms) between connection retry attempts |
| `maxRetries` | `number` | `5` | Maximum number of connection retry attempts |

## API Reference

### Constructor

```javascript
new RedisPoolManager(redisConfig, poolOptions)
```

### Methods

#### `acquireConnection()`
Acquires a Redis connection from the pool.

```javascript
const client = await pool.acquireConnection();
```

**Returns:** `Promise<RedisClient>` - Redis client ready for use  
**Throws:** `Error` - If pool is shutting down or timeout occurs

#### `releaseConnection(client)`
Releases a connection back to the pool.

```javascript
pool.releaseConnection(client);
```

**Parameters:**
- `client` - Redis client to release

#### `getStats()`
Returns comprehensive pool statistics.

```javascript
const stats = pool.getStats();
console.log(stats);
// {
//   created: 10,     // Total connections created
//   destroyed: 2,    // Total connections destroyed  
//   acquired: 150,   // Total acquisitions
//   released: 148,   // Total releases
//   errors: 1,       // Total errors
//   available: 8,    // Current available
//   busy: 2,         // Current in use
//   total: 10        // Current total
// }
```

#### `healthCheck()`
Performs health checks on all available connections.

```javascript
await pool.healthCheck();
```

#### `shutdown()`
Gracefully shuts down the pool and closes all connections.

```javascript
await pool.shutdown();
```

### Events

The pool emits the following events:

#### `ready`
Emitted when the pool is initialized and ready for use.

```javascript
pool.on('ready', () => {
  console.log('Pool is ready');
});
```

#### `error`
Emitted when pool-level errors occur.

```javascript
pool.on('error', (error) => {
  console.error('Pool error:', error);
});
```

## Advanced Usage

### Connection Pool with Monitoring

```javascript
import RedisPoolManager from 'redis-pool-manager';

const pool = new RedisPoolManager(
  { host: 'redis.example.com', port: 6379 },
  { maxConnections: 50, minConnections: 10 }
);

// Monitor pool statistics
setInterval(() => {
  const stats = pool.getStats();
  console.log(`Pool: ${stats.available} available, ${stats.busy} busy`);
}, 5000);

// Periodic health checks
setInterval(async () => {
  await pool.healthCheck();
}, 30000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await pool.shutdown();
  process.exit(0);
});
```

### Error Handling Best Practices

```javascript
async function safeRedisOperation(pool, operation) {
  let client;
  try {
    client = await pool.acquireConnection();
    return await operation(client);
  } catch (error) {
    console.error('Redis operation failed:', error);
    throw error;
  } finally {
    if (client) {
      pool.releaseConnection(client);
    }
  }
}

// Usage
const result = await safeRedisOperation(pool, async (client) => {
  return await client.get('some-key');
});
```

## Performance Tips

1. **Pool Sizing**: Set `minConnections` based on your baseline load and `maxConnections` based on peak load
2. **Connection Reuse**: Always release connections promptly to maximize reuse
3. **Health Checks**: Run periodic health checks in production environments
4. **Monitoring**: Monitor pool statistics to optimize configuration
5. **Error Handling**: Implement proper error handling to prevent connection leaks

## Troubleshooting

### Common Issues

**Connection Timeout Errors**
- Increase `connectionTimeout` value
- Check Redis server connectivity
- Verify pool isn't exhausted (`maxConnections` too low)

**Memory Leaks**
- Ensure all acquired connections are released
- Use try/finally blocks or the safe wrapper pattern

**High Error Rates**  
- Check Redis server health and network connectivity
- Monitor pool statistics for patterns
- Consider adjusting retry configuration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -am 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0
- Initial release
- Connection pooling with min/max scaling
- Health monitoring and error recovery
- Comprehensive statistics
- Event-driven architecture
- Full documentation and examples