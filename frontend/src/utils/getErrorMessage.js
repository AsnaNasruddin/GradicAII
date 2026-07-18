// FastAPI returns detail as a string for custom HTTPExceptions, but as an
// array of {msg, loc, ...} objects for automatic Pydantic validation errors
// (e.g. malformed email). Rendering the array directly as a React child
// crashes the whole app, so always route error responses through this.
export function getErrorMessage(err, fallback = 'Something went wrong') {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (typeof d === 'string' ? d : d?.msg))
      .filter(Boolean)
    return messages.length ? messages.join('; ') : fallback
  }
  return fallback
}
