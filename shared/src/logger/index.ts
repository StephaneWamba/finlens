/**
 * Winston logger configuration
 * Shared across all services
 */

import winston from 'winston'
import path from 'path'

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
)

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }: winston.Logform.TransformableInfo) => {
    let msg = `${timestamp} [${level}]: ${message}`
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`
    }
    return msg
  })
)

export function createLogger(serviceName: string, logDir = './logs'): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: serviceName },
    format: logFormat,
    transports: [
      // Console transport
      new winston.transports.Console({
        format: consoleFormat,
      }),
      // File transport - errors
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}-error.log`),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      // File transport - all logs
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}-combined.log`),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ],
  })
}

