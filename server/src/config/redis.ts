import { createClient, RedisClientType } from 'redis';
import { config } from './config';
import logger from '../utils/logger';

class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        reconnectStrategy: config.redis.retryStrategy,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.setupEventHandlers();
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client connected successfully');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.warn('Redis client disconnected');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
        throw error;
      }
    }
  }

  public getClient(): RedisClientType {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }

  // Utility methods
  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Error getting key ${key}:`, error);
      throw error;
    }
  }

  public async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    try {
      if (expirySeconds) {
        await this.client.setEx(key, expirySeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking key ${key}:`, error);
      throw error;
    }
  }

  public async flushAll(): Promise<void> {
    if (config.app.env !== 'test') {
      throw new Error('Cannot flush Redis in non-test environment');
    }
    try {
      await this.client.flushAll();
      logger.info('Redis database flushed');
    } catch (error) {
      logger.error('Error flushing Redis:', error);
      throw error;
    }
  }

  // Hash operations
  public async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hSet(key, field, value);
    } catch (error) {
      logger.error(`Error setting hash ${key}:`, error);
      throw error;
    }
  }

  public async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      logger.error(`Error getting hash ${key}:`, error);
      throw error;
    }
  }

  public async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error(`Error getting all hash ${key}:`, error);
      throw error;
    }
  }

  // Set operations
  public async sAdd(key: string, member: string): Promise<void> {
    try {
      await this.client.sAdd(key, member);
    } catch (error) {
      logger.error(`Error adding to set ${key}:`, error);
      throw error;
    }
  }

  public async sRem(key: string, member: string): Promise<void> {
    try {
      await this.client.sRem(key, member);
    } catch (error) {
      logger.error(`Error removing from set ${key}:`, error);
      throw error;
    }
  }

  public async sMembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      logger.error(`Error getting set members ${key}:`, error);
      throw error;
    }
  }

  public async sIsMember(key: string, member: string): Promise<boolean> {
    try {
      return await this.client.sIsMember(key, member);
    } catch (error) {
      logger.error(`Error checking set member ${key}:`, error);
      throw error;
    }
  }
}

export default RedisClient.getInstance();