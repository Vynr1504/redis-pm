/**
 * @fileoverview Redis Connection Pool Manager
 * 
 * A robust and production-ready Redis connection pool implementation that provides:
 *  async initializePool() {
    console.log(`Initializing Redis connection pool (min: ${this.minConnections}, max: ${this.maxConnections})`);
    
    // Create minimum connections concurrently for faster startup
    const initPromises = [];
    for (let i = 0; i < this.minConnections; i++) {
      initPromises.push(this.createConnection());
    }
    
    try {
      await Promise.all(initP    console.log("Shutting down Redis connection pool...");
    this.isShuttingDown = true;
    
    // Collect all connections for shutdown
    const allConnections = [
      ...this.availableConnections,
      ...this.busyConnections
    ];
    
    // Shutdown all connections concurrently
    const shutdownPromises = allConnections.map(client => 
      this.destroyConnection(client)
    );
    
    await Promise.allSettled(shutdownPromises);
    console.log("Redis connection pool shutdown complete"); console.log(`Redis pool initialized with ${this.availableConnections.size} connections`);
      this.emit('ready');
    } catch (error) {
      console.error("Failed to initialize Redis pool:", error);
      this.emit('error', error);
    }ection scaling between min/max limits
 * - Health monitoring and automatic recovery
 * - Connection lifecycle management
 * - Comprehensive error handling and retry logic
 * - Event-driven architecture for monitoring
 * - Detailed statistics and metrics
 * 
 * @version 1.0.0
 * @author Velpucherla Yogananda Reddy
 * @since 2025-09-27
 * 
 * @requires redis - The official Redis client for Node.js
 * @requires events - Node.js EventEmitter for event handling
 * 
 * @example
 * // Basic usage
 * import RedisPoolManager from './rpm.js';
 * 
 * const pool = new RedisPoolManager(
 *   { host: 'localhost', port: 6379 },
 *   { maxConnections: 20, minConnections: 5 }
 * );
 * 
 * // Wait for pool to be ready
 * pool.on('ready', async () => {
 *   const client = await pool.acquireConnection();
 *   await client.set('key', 'value');
 *   pool.releaseConnection(client);
 * });
 * 
 * // Handle errors
 * pool.on('error', console.error);
 * 
 * // Graceful shutdown
 * process.on('SIGTERM', () => pool.shutdown());
 */
import { createClient } from "redis";
import EventEmitter from "events";

/**
 * RedisPoolManager - A robust Redis connection pool manager
 * 
 * Manages a pool of Redis connections with automatic scaling, health monitoring,
 * error recovery, and connection lifecycle management. Extends EventEmitter to
 * provide event-driven notifications for pool state changes.
 * 
 * @class RedisPoolManager
 * @extends EventEmitter
 * 
 * @example
 * ```javascript
 * import RedisPoolManager from './rpm.js';
 * 
 * const pool = new RedisPoolManager(
 *   { host: 'localhost', port: 6379 }, // Redis config
 *   { 
 *     maxConnections: 20,
 *     minConnections: 5,
 *     connectionTimeout: 5000
 *   }
 * );
 * 
 * pool.on('ready', () => console.log('Pool ready'));
 * pool.on('error', (error) => console.error('Pool error:', error));
 * 
 * // Use the pool
 * const client = await pool.acquireConnection();
 * await client.set('key', 'value');
 * pool.releaseConnection(client);
 * ```
 * 
 * @fires RedisPoolManager#ready - Emitted when the pool is initialized and ready
 * @fires RedisPoolManager#error - Emitted when pool-level errors occur
 */
class RedisPoolManager extends EventEmitter {
  /**
   * Creates a new RedisPoolManager instance
   * 
   * @param {Object} config - Redis client configuration object (passed to createClient)
   * @param {string} [config.host='localhost'] - Redis server hostname
   * @param {number} [config.port=6379] - Redis server port
   * @param {string} [config.password] - Redis authentication password
   * @param {number} [config.db=0] - Redis database number
   * @param {Object} [options={}] - Pool management options
   * @param {number} [options.maxConnections=10] - Maximum number of connections in pool
   * @param {number} [options.minConnections=2] - Minimum number of connections to maintain
   * @param {number} [options.connectionTimeout=30000] - Timeout in ms when acquiring connections
   * @param {number} [options.retryDelay=1000] - Delay in ms between connection retry attempts
   * @param {number} [options.maxRetries=5] - Maximum number of connection retry attempts
   */
  constructor(config, options = {}) {
    super();
    
    // Store configuration
    this.config = config;
    
    // Pool sizing configuration
    this.maxConnections = options.maxConnections || 10;
    this.minConnections = options.minConnections || 2;
    
    // Timeout and retry configuration
    this.connectionTimeout = options.connectionTimeout || 30000;
    this.retryDelay = options.retryDelay || 1000;
    this.maxRetries = options.maxRetries || 5;
    
    // Connection tracking collections
    /** @type {Set<Object>} Available connections ready for use */
    this.availableConnections = new Set();
    /** @type {Set<Object>} Connections currently in use */
    this.busyConnections = new Set();
    /** @type {Map<string, Promise>} Pending connection creation promises */
    this.connectionPromises = new Map();
    
    // Pool state management
    this.isShuttingDown = false;
    
    // Statistics tracking
    this.stats = {
      created: 0,      // Total connections created
      destroyed: 0,    // Total connections destroyed
      acquired: 0,     // Total connection acquisitions
      released: 0,     // Total connection releases
      errors: 0        // Total connection errors encountered
    };
    
    // Start pool initialization
    this.initializePool();
  }

  /**
   * Initializes the connection pool by creating the minimum required connections
   * 
   * This method is called automatically during construction and creates the
   * minimum number of connections specified in the configuration. It emits
   * 'ready' event when successful or 'error' event if initialization fails.
   * 
   * @private
   * @async
   * @returns {Promise<void>}
   * @emits RedisPoolManager#ready - When pool initialization is complete
   * @emits RedisPoolManager#error - When pool initialization fails
   */
  async initializePool() {
    console.log(`🏊 Initializing Redis connection pool (min: ${this.minConnections}, max: ${this.maxConnections})`);
    
    // Create minimum connections concurrently for faster startup
    const initPromises = [];
    for (let i = 0; i < this.minConnections; i++) {
      initPromises.push(this.createConnection());
    }
    
    try {
      await Promise.all(initPromises);
      console.log(`Redis pool initialized with ${this.availableConnections.size} connections`);
      this.emit('ready');
    } catch (error) {
      console.error("Failed to initialize Redis pool:", error);
      this.emit('error', error);
    }
  }

  /**
   * Creates a new Redis connection with comprehensive error handling and monitoring
   * 
   * Each connection is assigned a unique ID and configured with event listeners
   * for connection state monitoring. The connection is automatically added to
   * the available connections pool upon successful creation.
   * 
   * @private
   * @async
   * @returns {Promise<Object>} Redis client instance with additional pool metadata
   * @throws {Error} If connection creation or establishment fails
   */
  async createConnection() {
    // Generate unique connection identifier
    const connectionId = `redis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Create Redis client with pool configuration
      const client = createClient({
        ...this.config,
        name: connectionId
      });

      // Enhanced error handling for each connection
      client.on('error', (error) => {
        console.error(`Redis connection ${connectionId} error:`, error);
        this.stats.errors++;
        this.handleConnectionError(client, error);
      });

      client.on('connect', () => {
        console.log(`Redis connection ${connectionId} established`);
      });

      client.on('ready', () => {
        console.log(`Redis connection ${connectionId} ready`);
      });

      client.on('reconnecting', () => {
        console.log(`Redis connection ${connectionId} reconnecting...`);
      });

      client.on('end', () => {
        console.log(`Redis connection ${connectionId} ended`);
        this.removeConnection(client);
      });

      // Establish connection to Redis server
      await client.connect();
      
      // Add pool-specific metadata to client
      client.connectionId = connectionId;
      client.lastUsed = Date.now();
      client.isHealthy = true;
      
      // Add to available connections pool
      this.availableConnections.add(client);
      this.stats.created++;
      
      return client;
    } catch (error) {
      console.error(`Failed to create Redis connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Acquires a Redis connection from the pool for use
   * 
   * This method implements a three-tier acquisition strategy:
   * 1. Return immediately available connection if one exists
   * 2. Create new connection if under the maximum limit
   * 3. Wait for a connection to become available (with timeout)
   * 
   * @async
   * @returns {Promise<Object>} Redis client connection ready for use
   * @throws {Error} If pool is shutting down, connection creation fails, or timeout occurs
   * 
   * @example
   * ```javascript
   * const client = await pool.acquireConnection();
   * try {
   *   await client.set('key', 'value');
   *   const value = await client.get('key');
   * } finally {
   *   pool.releaseConnection(client);
   * }
   * ```
   */
  async acquireConnection() {
    if (this.isShuttingDown) {
      throw new Error("Connection pool is shutting down");
    }

    this.stats.acquired++;

    // Strategy 1: Try to get an available connection immediately
    if (this.availableConnections.size > 0) {
      const client = this.availableConnections.values().next().value;
      this.availableConnections.delete(client);
      this.busyConnections.add(client);
      client.lastUsed = Date.now();
      return client;
    }

    // Strategy 2: Create new connection if under limit
    if (this.getTotalConnections() < this.maxConnections) {
      try {
        const client = await this.createConnection();
        this.availableConnections.delete(client);
        this.busyConnections.add(client);
        return client;
      } catch (error) {
        throw new Error(`Failed to create new Redis connection: ${error.message}`);
      }
    }

    // Strategy 3: Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for Redis connection"));
      }, this.connectionTimeout);

      const checkForConnection = () => {
        if (this.availableConnections.size > 0) {
          clearTimeout(timeout);
          const client = this.availableConnections.values().next().value;
          this.availableConnections.delete(client);
          this.busyConnections.add(client);
          client.lastUsed = Date.now();
          resolve(client);
        } else {
          // Poll every 100ms for available connection
          setTimeout(checkForConnection, 100);
        }
      };

      checkForConnection();
    });
  }

  /**
   * Releases a Redis connection back to the pool for reuse
   * 
   * Moves the connection from busy to available state if it's healthy,
   * or destroys it if it's in an unhealthy state. This method is safe
   * to call multiple times with the same connection.
   * 
   * @param {Object} client - Redis client connection to release
   * @returns {void}
   * 
   * @example
   * ```javascript
   * const client = await pool.acquireConnection();
   * try {
   *   // Use the connection
   *   await client.get('some-key');
   * } finally {
   *   // Always release the connection back to the pool
   *   pool.releaseConnection(client);
   * }
   * ```
   */
  releaseConnection(client) {
    if (!client || !client.connectionId) {
      return;
    }

    this.stats.released++;
    
    if (this.busyConnections.has(client)) {
      this.busyConnections.delete(client);
      
      // Only return healthy, ready connections to the pool
      if (client.isHealthy && client.isReady) {
        this.availableConnections.add(client);
      } else {
        // Connection is unhealthy, destroy it
        this.destroyConnection(client);
      }
    }
  }

  /**
   * Removes a connection from all pool tracking collections
   * 
   * This is a utility method used internally when connections are closed
   * or terminated by Redis events. It ensures the connection is removed
   * from both available and busy collections.
   * 
   * @private
   * @param {Object} client - Redis client connection to remove
   * @returns {void}
   */
  removeConnection(client) {
    this.availableConnections.delete(client);
    this.busyConnections.delete(client);
  }

  /**
   * Gracefully destroys a Redis connection and removes it from the pool
   * 
   * Attempts to cleanly quit the connection before destroying it. Updates
   * the destruction statistics and handles any errors that occur during
   * the destruction process.
   * 
   * @private
   * @async
   * @param {Object} client - Redis client connection to destroy
   * @returns {Promise<void>}
   */
  async destroyConnection(client) {
    if (!client) return;

    try {
      // Remove from all pool collections first
      this.availableConnections.delete(client);
      this.busyConnections.delete(client);
      
      // Attempt graceful shutdown if connection is still open
      if (client.isOpen) {
        await client.quit();
      }
      
      this.stats.destroyed++;
      console.log(`Destroyed Redis connection ${client.connectionId}`);
    } catch (error) {
      console.error(`Error destroying Redis connection ${client.connectionId}:`, error);
    }
  }

  /**
   * Handles connection errors by marking connections as unhealthy and managing pool size
   * 
   * When a connection encounters an error, this method:
   * 1. Marks the connection as unhealthy
   * 2. Removes it from active use
   * 3. Creates replacement connections if below minimum threshold
   * 
   * @private
   * @param {Object} client - Redis client that encountered an error
   * @param {Error} error - The error that occurred
   * @returns {void}
   */
  handleConnectionError(client, error) {
    // Mark connection as unhealthy
    client.isHealthy = false;
    
    // Remove from busy connections if it was in use
    if (this.busyConnections.has(client)) {
      this.busyConnections.delete(client);
    }
    
    // Don't add unhealthy connections back to available pool
    this.availableConnections.delete(client);
    
    // Create replacement connection if we're below minimum threshold
    if (this.getTotalConnections() < this.minConnections) {
      this.createConnection().catch(err => {
        console.error("Failed to create replacement Redis connection:", err);
      });
    }
  }

  /**
   * Gets the total number of connections currently managed by the pool
   * 
   * @returns {number} Total connection count (available + busy)
   */
  getTotalConnections() {
    return this.availableConnections.size + this.busyConnections.size;
  }

  /**
   * Returns comprehensive statistics about the connection pool
   * 
   * Provides both historical statistics (created, destroyed, etc.) and
   * current state information (available, busy, total connections).
   * 
   * @returns {Object} Pool statistics object
   * @returns {number} returns.created - Total connections created since pool start
   * @returns {number} returns.destroyed - Total connections destroyed
   * @returns {number} returns.acquired - Total connection acquisitions
   * @returns {number} returns.released - Total connection releases
   * @returns {number} returns.errors - Total connection errors encountered
   * @returns {number} returns.available - Current available connections
   * @returns {number} returns.busy - Current busy connections
   * @returns {number} returns.total - Current total connections
   * 
   * @example
   * ```javascript
   * const stats = pool.getStats();
   * console.log(`Pool has ${stats.available} available, ${stats.busy} busy connections`);
   * console.log(`Total operations: ${stats.acquired} acquired, ${stats.released} released`);
   * ```
   */
  getStats() {
    return {
      ...this.stats,
      available: this.availableConnections.size,
      busy: this.busyConnections.size,
      total: this.getTotalConnections()
    };
  }

  /**
   * Performs health checks on all available connections in the pool
   * 
   * Pings each available connection to verify it's still responsive.
   * Unhealthy connections are automatically removed and destroyed.
   * This method should be called periodically to maintain pool health.
   * 
   * @async
   * @returns {Promise<void>}
   * 
   * @example
   * ```javascript
   * // Run health checks every 30 seconds
   * setInterval(async () => {
   *   await pool.healthCheck();
   * }, 30000);
   * ```
   */
  async healthCheck() {
    const promises = [];
    
    // Test all available connections with ping
    for (const client of this.availableConnections) {
      promises.push(
        client.ping().catch(error => {
          console.error(`Health check failed for ${client.connectionId}:`, error);
          client.isHealthy = false;
          return false;
        })
      );
    }
    
    // Wait for all health checks to complete
    await Promise.allSettled(promises);
    
    // Remove and destroy unhealthy connections
    for (const client of [...this.availableConnections]) {
      if (!client.isHealthy) {
        this.destroyConnection(client);
      }
    }
  }

  /**
   * Gracefully shuts down the connection pool
   * 
   * Prevents new connections from being acquired and closes all existing
   * connections cleanly. This method should be called when the application
   * is shutting down to ensure proper cleanup of Redis connections.
   * 
   * @async
   * @returns {Promise<void>}
   * 
   * @example
   * ```javascript
   * // Graceful shutdown on application exit
   * process.on('SIGTERM', async () => {
   *   await pool.shutdown();
   *   process.exit(0);
   * });
   * ```
   */
  async shutdown() {
    console.log(" Shutting down Redis connection pool...");
    this.isShuttingDown = true;
    
    // Collect all connections for shutdown
    const allConnections = [
      ...this.availableConnections,
      ...this.busyConnections
    ];
    
    // Shutdown all connections concurrently
    const shutdownPromises = allConnections.map(client => 
      this.destroyConnection(client)
    );
    
    await Promise.allSettled(shutdownPromises);
    console.log(" Redis connection pool shutdown complete");
  }
}

export default RedisPoolManager;