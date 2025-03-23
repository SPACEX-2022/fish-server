import { HttpResponse, SUCCESS_CODE, ErrorCode } from '../interfaces/http-response.interface';

/**
 * 创建成功响应
 * @param data 响应数据
 * @param message 成功消息
 * @returns 标准响应对象
 */
export function success<T>(data: T, message = '操作成功'): HttpResponse<T> {
  return {
    code: SUCCESS_CODE,
    result: data,
    message,
  };
}

/**
 * 创建错误响应
 * @param code 错误码
 * @param message 错误消息
 * @returns 标准响应对象
 */
export function error(code: ErrorCode, message: string): HttpResponse<null> {
  return {
    code,
    result: null,
    message,
  };
}

/**
 * 创建业务错误响应
 * @param message 错误消息
 * @returns 标准响应对象
 */
export function businessError(message: string, code = ErrorCode.BAD_REQUEST): HttpResponse<null> {
  return error(code, message);
}

/**
 * 创建未授权响应
 * @param message 错误消息
 * @returns 标准响应对象
 */
export function unauthorized(message = '未授权'): HttpResponse<null> {
  return error(ErrorCode.UNAUTHORIZED, message);
}

/**
 * 创建没有权限响应
 * @param message 错误消息
 * @returns 标准响应对象
 */
export function forbidden(message = '没有权限'): HttpResponse<null> {
  return error(ErrorCode.FORBIDDEN, message);
}

/**
 * 创建资源不存在响应
 * @param message 错误消息
 * @returns 标准响应对象
 */
export function notFound(message = '资源不存在'): HttpResponse<null> {
  return error(ErrorCode.NOT_FOUND, message);
} 