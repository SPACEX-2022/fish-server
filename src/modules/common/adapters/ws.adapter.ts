import { WebSocketAdapter, INestApplicationContext } from '@nestjs/common';
import { MessageMappingProperties } from '@nestjs/websockets';
import * as WebSocket from 'ws';
import { Observable, fromEvent, EMPTY } from 'rxjs';
import { mergeMap, filter } from 'rxjs/operators';
import { Logger } from '@nestjs/common';

/**
 * 原生WebSocket适配器
 * 替代默认的Socket.IO适配器，使NestJS可以使用原生WebSocket
 */
export class WsAdapter implements WebSocketAdapter {
  private readonly logger = new Logger(WsAdapter.name);
  private wsServer: WebSocket.Server;

  constructor(private app: INestApplicationContext) {}

  create(port: number, options: any = {}): any {
    this.wsServer = new WebSocket.Server({ port, ...options });
    return this.wsServer;
  }

  bindClientConnect(server: WebSocket.Server, callback: (client: WebSocket) => void): void {
    server.on('connection', (client: WebSocket, req: any) => {
      client['req'] = req; // 保存请求对象，以便后续访问URL和headers
      callback(client);
    });
  }

  bindMessageHandlers(
    client: WebSocket,
    handlers: MessageMappingProperties[],
    process: (data: any) => Observable<any>,
  ): void {
    fromEvent(client, 'message')
      .pipe(
        mergeMap(data => this.handleMessage(client, data, handlers, process)),
        filter(result => result),
      )
      .subscribe(response => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(response));
        }
      });
  }

  private handleMessage(
    client: WebSocket,
    message: any,
    handlers: MessageMappingProperties[],
    process: (data: any) => Observable<any>,
  ): Observable<any> {
    const messageString = message.data.toString();
    
    try {
      // 尝试解析消息为JSON
      const messageData = JSON.parse(messageString);
      
      if (!messageData.event) {
        this.logger.warn('收到消息但无event字段', messageData);
        return EMPTY;
      }

      const eventName = messageData.event;
      const data = messageData.data || {};
      
      // 查找匹配的处理程序
      const handler = handlers.find(h => h.message === eventName);
      
      if (!handler) {
        this.logger.warn(`未找到事件 '${eventName}' 的处理程序`);
        return EMPTY;
      }

      // 处理消息并返回结果
      return process(handler.callback(data));
    } catch (e) {
      this.logger.error('消息处理错误', e);
      return EMPTY;
    }
  }

  close(server: WebSocket.Server): void {
    server.close();
  }
} 