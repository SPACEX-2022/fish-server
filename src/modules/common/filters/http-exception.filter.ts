import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../interfaces/http-response.interface';

/**
 * HTTP异常过滤器
 * 捕获所有异常并将其转换为标准的HTTP响应格式
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 处理HTTP异常
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // 获取错误消息
    let message = '服务器内部错误';
    let code = ErrorCode.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      const exceptionMessage = typeof exceptionResponse === 'object' 
        ? (exceptionResponse as any).message || exception.message
        : exception.message;
      
      message = Array.isArray(exceptionMessage) ? exceptionMessage[0] : exceptionMessage;
      
      // 根据HTTP状态码映射到自定义错误码
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          code = ErrorCode.BAD_REQUEST;
          break;
        case HttpStatus.UNAUTHORIZED:
          code = ErrorCode.UNAUTHORIZED;
          break;
        case HttpStatus.FORBIDDEN:
          code = ErrorCode.FORBIDDEN;
          break;
        case HttpStatus.NOT_FOUND:
          code = ErrorCode.NOT_FOUND;
          break;
        case HttpStatus.UNPROCESSABLE_ENTITY:
          code = ErrorCode.VALIDATION_ERROR;
          break;
        default:
          code = ErrorCode.INTERNAL_SERVER_ERROR;
      }
    } else {
      this.logger.error(`服务器内部错误: ${exception.message}`, exception.stack);
    }

    // 记录异常信息到日志
    const path = request.url;
    const timestamp = new Date().toISOString();
    this.logger.error(`[${timestamp}] ${request.method} ${path} ${status} - ${message}`);

    // 发送标准化的响应
    response.status(status).json({
      code,
      result: null,
      message,
      timestamp,
      path,
    });
  }
} 