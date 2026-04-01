/* tslint:disable */
/* eslint-disable */

export class SaveParser {
    free(): void;
    [Symbol.dispose](): void;
    finish(filename: string): string;
    finish_input(): void;
    constructor();
    progress_json(): string;
    pump(max_events: number): boolean;
    push_chunk(chunk: Uint8Array): void;
    set_expected_total_bytes(total: number): void;
    set_expected_version(version: string): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_saveparser_free: (a: number, b: number) => void;
    readonly saveparser_finish: (a: number, b: number, c: number) => [number, number, number, number];
    readonly saveparser_finish_input: (a: number) => void;
    readonly saveparser_new: () => number;
    readonly saveparser_progress_json: (a: number) => [number, number];
    readonly saveparser_pump: (a: number, b: number) => number;
    readonly saveparser_push_chunk: (a: number, b: number, c: number) => void;
    readonly saveparser_set_expected_total_bytes: (a: number, b: number) => void;
    readonly saveparser_set_expected_version: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
