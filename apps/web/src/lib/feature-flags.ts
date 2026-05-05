import "server-only"

export function useFastApiAi(): boolean {
  return process.env.USE_FASTAPI_AI === "true"
}
