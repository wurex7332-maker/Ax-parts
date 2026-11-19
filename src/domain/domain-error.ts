/** 领域层错误：不依赖 Nest/HTTP，由 service 层翻译为具体接口错误码。 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
