import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { compactRecord, toSerializableValue } from '../utils/serialize.js'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
}

export interface LoggerOptions {
    name: string
    context?: Record<string, unknown>
    level?: LogLevel
    logFilePath?: string | null
}

function resolveDefaultLogLevel(): LogLevel {
    const configuredLevel = process.env.LOG_LEVEL?.trim().toLowerCase()

    if (
        configuredLevel === 'debug' ||
        configuredLevel === 'info' ||
        configuredLevel === 'warn' ||
        configuredLevel === 'error'
    ) {
        return configuredLevel
    }

    return process.env.NODE_ENV === 'test' ? 'error' : 'info'
}

export class Logger {
    private readonly name: string
    private readonly context: Record<string, unknown>
    private readonly level: LogLevel
    private readonly logFilePath: string | null

    constructor(options: LoggerOptions) {
        this.name = options.name
        this.context = options.context ?? {}
        this.level = options.level ?? resolveDefaultLogLevel()
        this.logFilePath = options.logFilePath ?? null
    }

    child(context: Record<string, unknown>): Logger {
        return new Logger({
            name: this.name,
            context: {
                ...this.context,
                ...context,
            },
            level: this.level,
            logFilePath: this.logFilePath,
        })
    }

    debug(message: string, details?: Record<string, unknown>): void {
        this.write('debug', message, details)
    }

    info(message: string, details?: Record<string, unknown>): void {
        this.write('info', message, details)
    }

    warn(message: string, details?: Record<string, unknown>): void {
        this.write('warn', message, details)
    }

    error(message: string, details?: Record<string, unknown>): void {
        this.write('error', message, details)
    }

    private write(
        level: LogLevel,
        message: string,
        details?: Record<string, unknown>
    ): void {
        if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
            return
        }

        const entry = compactRecord({
            timestamp: new Date().toISOString(),
            level,
            logger: this.name,
            message,
            ...toSerializableValue(this.context) as Record<string, unknown>,
            ...toSerializableValue(details ?? {}) as Record<string, unknown>,
        })

        const serialized = JSON.stringify(entry)

        if (level === 'error') {
            console.error(serialized)
        } else if (level === 'warn') {
            console.warn(serialized)
        } else {
            console.log(serialized)
        }

        if (this.logFilePath) {
            const resolvedPath = path.resolve(this.logFilePath)
            mkdirSync(path.dirname(resolvedPath), { recursive: true })
            appendFileSync(resolvedPath, `${serialized}\n`, 'utf8')
        }
    }
}

export function createLogger(options: LoggerOptions): Logger {
    return new Logger(options)
}
