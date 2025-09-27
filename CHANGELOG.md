# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-09-27

### Added
- Initial release of Redis Pool Manager
- Connection pooling with configurable min/max connections
- Automatic connection scaling and health monitoring
- Comprehensive error handling and recovery
- Event-driven architecture with 'ready' and 'error' events
- Detailed statistics and metrics tracking
- TypeScript definitions for better developer experience
- Complete documentation and usage examples
- Benchmark suite for performance testing

### Features
- **Pool Management**: Dynamic scaling between min/max connection limits
- **Health Monitoring**: Automatic health checks with unhealthy connection removal
- **Error Recovery**: Robust error handling with automatic reconnection
- **Statistics**: Detailed metrics (created, destroyed, acquired, released, errors)
- **Events**: EventEmitter-based notifications for pool state changes
- **Performance**: Optimized connection acquisition with three-tier strategy
- **Production Ready**: Comprehensive logging and graceful shutdown