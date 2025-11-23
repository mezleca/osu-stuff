export type GenericResult<T> = { success: true; data: T } | { success: false; reason: string };
