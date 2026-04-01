export class Stream {
  pipe<T>(destination: T): T {
    return destination
  }

  on(): this {
    return this
  }

  once(): this {
    return this
  }

  emit(): boolean {
    return false
  }
}

export default { Stream }
