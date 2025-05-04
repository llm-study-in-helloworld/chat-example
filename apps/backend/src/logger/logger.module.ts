import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import { LogInterceptor } from './log.interceptor';
import { LoggerService } from './logger.service';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        
        // Define log format
        const logFormat = winston.format.combine(
          winston.format.timestamp(),
          isProduction
            ? winston.format.json()
            : nestWinstonModuleUtilities.format.nestLike('ChatApp', {
                prettyPrint: true,
                colors: true,
              }),
        );

        return {
          transports: [
            // Console logger
            new winston.transports.Console({
              format: logFormat,
              level: isProduction ? 'info' : 'debug',
            }),
            
            // File logger for errors (production)
            ...(isProduction
              ? [
                  new winston.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    format: winston.format.combine(
                      winston.format.timestamp(),
                      winston.format.json(),
                    ),
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5,
                  }),
                  new winston.transports.File({
                    filename: 'logs/combined.log',
                    format: winston.format.combine(
                      winston.format.timestamp(),
                      winston.format.json(),
                    ),
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5,
                  }),
                ]
              : []),
          ],
        };
      },
    }),
  ],
  providers: [LoggerService, LogInterceptor],
  exports: [WinstonModule, LoggerService, LogInterceptor],
})
export class LoggerModule {} 