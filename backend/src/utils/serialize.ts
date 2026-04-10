type SerializableObject = Record<string, unknown>

function isPlainObject(value: unknown): value is SerializableObject {
    if (!value || typeof value !== 'object') {
        return false
    }

    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

export function toSerializableValue(
    value: unknown,
    seen: WeakSet<object> = new WeakSet()
): unknown {
    if (value === undefined || value === null) {
        return value
    }

    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value
    }

    if (typeof value === 'bigint') {
        return value.toString()
    }

    if (value instanceof Date) {
        return value.toISOString()
    }

    if (value instanceof Error) {
        return compactRecord({
            name: value.name,
            message: value.message,
            stack: value.stack,
            cause: toSerializableValue((value as Error & { cause?: unknown }).cause, seen),
        })
    }

    if (Array.isArray(value)) {
        return value.map((entry) => toSerializableValue(entry, seen))
    }

    if (typeof value === 'object') {
        if (seen.has(value)) {
            return '[Circular]'
        }

        seen.add(value)

        if (isPlainObject(value)) {
            const serializedEntries = Object.entries(value).flatMap(([key, entry]) => {
                const serializedEntry = toSerializableValue(entry, seen)

                return serializedEntry === undefined ? [] : ([[key, serializedEntry]] as const)
            })

            seen.delete(value)
            return Object.fromEntries(serializedEntries)
        }

        const serializedValue = String(value)
        seen.delete(value)
        return serializedValue
    }

    return String(value)
}

export function compactRecord(
    value: Record<string, unknown>
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(value).flatMap(([key, entry]) =>
            entry === undefined ? [] : ([[key, entry]] as const)
        )
    )
}
