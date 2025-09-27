import { EventEmitter } from 'events';
import { RedisClientType, RedisClientOptions } from 'redis';

export interface PoolOptions {
  /**
   * Maximum number of connections in the pool
   * @default 10
   */
  maxConnections?: number;

  /**
   * Minimum number of connections to maintain in the pool
   * @default 2
   */
  minConnections?: number;

  /**
   * Timeout in milliseconds when acquiring connections
   * @default 30000
   */
  connectionTimeout?: number;

  /**
   * Delay in milliseconds between connection retry attempts
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Maximum number of connection retry attempts
   * @default 5
   */
  maxRetries?: number;
}

export interface PoolStats {
  /** Total connections created since pool start */
  created: number;

  /** Total connections destroyed */
  destroyed: number;

  /** Total connection acquisitions */
  acquired: number;

  /** Total connection releases */
  released: number;

  /** Total connection errors encountered */
  errors: number;

  /** Current number of available connections */
  available: number;

  /** Current number of busy connections */
  busy: number;

  /** Current total number of connections */
  total: number;
}

export interface RedisPoolClient extends RedisClientType {
  /** Unique connection identifier assigned by the pool */
  connectionId: string;

  /** Timestamp of when the connection was last used */
  lastUsed: number;

  /** Whether the connection is considered healthy */
  isHealthy: boolean;
}

/**
 * RedisPoolManager - A robust Redis connection pool manager
 * 
 * Manages a pool of Redis connections with automatic scaling, health monitoring,
 * error recovery, and connection lifecycle management.
 */
export default class RedisPoolManager extends EventEmitter {
  /** Redis client configuration */
  readonly config: RedisClientOptions;

  /** Maximum number of connections in pool */
  readonly maxConnections: number;

  /** Minimum number of connections to maintain */
  readonly minConnections: number;

  /** Connection acquisition timeout in milliseconds */
  readonly connectionTimeout: number;

  /** Retry delay in milliseconds */
  readonly retryDelay: number;

  /** Maximum retry attempts */
  readonly maxRetries: number;

  /** Set of available connections ready for use */
  readonly availableConnections: Set<RedisPoolClient>;

  /** Set of connections currently in use */
  readonly busyConnections: Set<RedisPoolClient>;

  /** Map of pending connection creation promises */
  readonly connectionPromises: Map<string, Promise<RedisPoolClient>>;

  /** Whether the pool is shutting down */
  readonly isShuttingDown: boolean;

  /** Pool statistics */
  readonly stats: {
    created: number;
    destroyed: number;
    acquired: number;
    released: number;
    errors: number;
  };

  /**
   * Creates a new RedisPoolManager instance
   * 
   * @param config Redis client configuration object
   * @param options Pool management options
   */
  constructor(config: RedisClientOptions, options?: PoolOptions);

  /**
   * Acquires a Redis connection from the pool for use
   * 
   * @returns Promise that resolves to a Redis client ready for use
   * @throws Error if pool is shutting down, connection creation fails, or timeout occurs
   */
  acquireConnection(): Promise<RedisPoolClient>;

  /**
   * Releases a Redis connection back to the pool for reuse
   * 
   * @param client Redis client connection to release
   */
  releaseConnection(client: RedisPoolClient): void;

  /**
   * Returns comprehensive statistics about the connection pool
   * 
   * @returns Pool statistics object with current and historical data
   */
  getStats(): PoolStats;

  /**
   * Performs health checks on all available connections in the pool
   * 
   * Pings each available connection and removes unhealthy ones.
   * 
   * @returns Promise that resolves when health checks are complete
   */
  healthCheck(): Promise<void>;

  /**
   * Gracefully shuts down the connection pool
   * 
   * Prevents new connections from being acquired and closes all existing connections.
   * 
   * @returns Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<void>;

  /**
   * Gets the total number of connections currently managed by the pool
   * 
   * @returns Total connection count (available + busy)
   */
  getTotalConnections(): number;

  // EventEmitter events

  /**
   * Emitted when the pool is initialized and ready for use
   */
  on(event: 'ready', listener: () => void): this;

  /**
   * Emitted when pool-level errors occur
   */
  on(event: 'error', listener: (error: Error) => void): this;

  /**
   * Generic event listener for any event
   */
  on(event: string | symbol, listener: (...args: any[]) => void): this;

  /**
   * Emitted when the pool is initialized and ready for use
   */
  once(event: 'ready', listener: () => void): this;

  /**
   * Emitted when pool-level errors occur
   */
  once(event: 'error', listener: (error: Error) => void): this;

  /**
   * Generic event listener for any event (once)
   */
  once(event: string | symbol, listener: (...args: any[]) => void): this;

  /**
   * Emitted when the pool is initialized and ready for use
   */
  emit(event: 'ready'): boolean;

  /**
   * Emitted when pool-level errors occur
   */
  emit(event: 'error', error: Error): boolean;

  /**
   * Generic event emitter
   */
  emit(event: string | symbol, ...args: any[]): boolean;
}

export { RedisPoolManager };