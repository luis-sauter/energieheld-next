// Retry only read operations and transient upstream errors. Never repeat writes or permission failures.
export async function retryMediaRead<T extends { error: unknown }>(read: () => PromiseLike<T>): Promise<T> {
  const result = await read();
  const error = result.error as {status?:number;statusCode?:number|string;code?:string;message?:string}|null;
  const status = Number(error?.status ?? error?.statusCode);
  if (error && (status >= 500 || ["PGRST000", "PGRST001", "PGRST002"].includes(error.code ?? "") || /fetch failed|failed to fetch|networkerror/i.test(error.message ?? ""))) return await read();
  return result;
}
