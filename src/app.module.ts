import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ProductsModule } from './products/products.module'; // 👈 ১. এখানে ইমপোর্ট করুন

@Module({
  imports: [
    // Global Config Module
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // MongoDB Connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),

    // Redis Cache Connection
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get<string>('REDIS_HOST'),
            port: configService.get<number>('REDIS_PORT'),
          },
          ttl: 60 * 1000,
        }),
      }),
      inject: [ConfigService],
    }),

    // Feature Modules
    ProductsModule, // 👈 ২. এখানে এড করে দিন
  ],
})
export class AppModule {}