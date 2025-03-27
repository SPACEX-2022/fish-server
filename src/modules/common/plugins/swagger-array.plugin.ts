import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { OpenAPIObject } from '@nestjs/swagger';

/**
 * 修复 Swagger 文档中数组显示问题的插件
 * 
 * @param document Swagger 文档对象
 * @returns 修改后的 Swagger 文档对象
 */
export function fixArraySchemas(document: OpenAPIObject): OpenAPIObject {
  // 为了避免类型问题，使用 any 类型
  const docAny = document as any;
  
  // 深度处理所有 Schema 对象
  if (docAny.components && docAny.components.schemas) {
    for (const schemaName in docAny.components.schemas) {
      const schema = docAny.components.schemas[schemaName];
      // 处理 properties 中的数组
      if (schema.properties) {
        for (const propName in schema.properties) {
          const property = schema.properties[propName];
          if (property.type === 'array' && property.items && property.$ref) {
            // 修复带有 $ref 的数组属性
            property.items = { $ref: property.$ref };
            delete property.$ref;
          }
        }
      }
    }
  }
  
  // 处理所有路径下的响应
  if (docAny.paths) {
    for (const path in docAny.paths) {
      const pathItem = docAny.paths[path];
      for (const method in pathItem) {
        const operation = pathItem[method];
        if (operation.responses) {
          for (const status in operation.responses) {
            const response = operation.responses[status];
            if (response.content && response.content['application/json'] && 
                response.content['application/json'].schema) {
              const schema = response.content['application/json'].schema;
              fixSchema(schema);
            }
          }
        }
      }
    }
  }
  
  return document;
}

/**
 * 递归修复 Schema 对象
 * 
 * @param schema Schema 对象
 */
function fixSchema(schema: any) {
  if (schema.properties) {
    for (const propName in schema.properties) {
      const property = schema.properties[propName];
      if (property.type === 'array' && property.items && property.$ref) {
        // 修复带有 $ref 的数组属性
        property.items = { $ref: property.$ref };
        delete property.$ref;
      } else if (property.properties || property.items) {
        // 递归处理嵌套对象
        fixSchema(property);
      }
    }
  }
  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      fixSchema(subSchema);
    }
  }
  if (schema.items) {
    fixSchema(schema.items);
  }
} 