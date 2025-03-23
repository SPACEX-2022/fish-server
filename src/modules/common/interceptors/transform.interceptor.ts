import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpResponse, SUCCESS_CODE } from '../interfaces/http-response.interface';

/**
 * 响应转换拦截器
 * 将所有控制器方法的返回值转换为标准HTTP响应格式
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, HttpResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<HttpResponse<T>> {
    return next.handle().pipe(
      map(data => {
        // 检查是否已经是标准响应格式
        if (data && typeof data === 'object' && 'code' in data && 'result' in data && 'message' in data) {
          return data as HttpResponse<T>;
        }
        
        // 转换为标准响应格式
        return {
          code: SUCCESS_CODE,
          result: data,
          message: '操作成功',
        };
      }),
    );
  }
} 