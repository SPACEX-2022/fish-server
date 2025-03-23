/**
 * 标准HTTP响应接口
 * 所有API返回都应遵循此格式
 */
export interface HttpResponse<T = any> {
  /**
   * 状态码，成功为0，失败为非0值
   */
  code: number;

  /**
   * 结果数据，成功时返回
   */
  result: T;

  /**
   * 消息，通常在发生错误时提供更多信息
   */
  message: string;
}

/**
 * API成功响应状态码
 */
export const SUCCESS_CODE = 0;

/**
 * 常见错误码
 */
export enum ErrorCode {
  // 客户端错误 (1000-1999)
  BAD_REQUEST = 1000,
  UNAUTHORIZED = 1001,
  FORBIDDEN = 1003,
  NOT_FOUND = 1004,
  VALIDATION_ERROR = 1005,
  
  // 服务端错误 (2000-2999)
  INTERNAL_SERVER_ERROR = 2000,
  SERVICE_UNAVAILABLE = 2001,
  
  // 业务逻辑错误 (3000+)
  ROOM_FULL = 3000,
  ROOM_CLOSED = 3001,
  GAME_ALREADY_STARTED = 3002,
  OPERATION_NOT_ALLOWED = 3003,
} 