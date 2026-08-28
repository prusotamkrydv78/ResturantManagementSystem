/** Shape returned by the backend's GET /health endpoint. */
export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
  timestampUtc: string;
}
