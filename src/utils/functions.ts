export function omit<T extends (object | undefined), S extends (keyof T | string)>(object: T, key: S) {
    if (object !== undefined && key in object) {
        delete object[key as keyof object]
    }
    return object as T extends undefined ? T : Omit<T, S>
}
