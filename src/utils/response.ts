export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    cached: boolean;
    timestamp: string;
    took_ms: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta: {
    timestamp: string;
  };
}

export function successResponse<T>(data: T, cached: boolean, startTime: number): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      cached,
      timestamp: new Date().toISOString(),
      took_ms: Date.now() - startTime,
    },
  };
}

export function errorResponse(code: string, message: string): ApiError {
  return {
    success: false,
    error: { code, message },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}
