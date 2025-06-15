export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;
export type Maybe<T> = T | undefined;
export type NonEmptyArray<T> = [T, ...T[]];

export type Timestamp = number;
export type Address = string;
export type Hash = string;
export type BigNumberish = string | number | bigint;

export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> = T extends (
    ...args: unknown[]
) => Promise<infer R>
    ? R
    : unknown;

export type ValueOf<T> = T[keyof T];
export type KeysOfType<T, U> = {
    [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export interface Pagination {
    page: number;
    limit: number;
    total?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
}

export interface SortOptions {
    field: string;
    direction: 'asc' | 'desc';
}

export interface FilterOptions {
    [key: string]: unknown;
}

export interface QueryOptions {
    pagination?: Pagination;
    sort?: SortOptions;
    filters?: FilterOptions;
    search?: string;
}

export type Status = 'idle' | 'loading' | 'success' | 'error';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';