import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, getSchemaPath } from '@nestjs/swagger';
import { HttpResponse } from '../interfaces/http-response.interface';

/**
 * 标准响应Swagger装饰器
 * 用于在Swagger文档中显示标准响应格式
 * 
 * @param type 响应数据类型
 * @param description 操作描述
 * @returns 装饰器
 */
export function ApiStandardResponse<T extends Type<any>>(
  type?: T,
  description = '操作成功'
) {
  return applyDecorators(
    ApiOperation({ summary: description }),
    type ? ApiExtraModels(type) : ApiExtraModels(),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          {
            properties: {
              code: {
                type: 'number',
                example: 0,
                description: '状态码，0表示成功，非0表示错误'
              },
              message: {
                type: 'string',
                example: '操作成功',
                description: '响应消息'
              },
              result: type
                ? {
                    $ref: getSchemaPath(type),
                  }
                : {
                    type: 'object',
                    example: {},
                    description: '响应数据'
                  },
            },
          },
        ],
      },
    }),
  );
} 