# WebSocket 채팅 애플리케이션 성능 보고서

## 개요

WebSocket 채팅 애플리케이션의 성능 테스트 결과, 확장성에 영향을 미치는 여러 중요한 병목 현상이 발견되었습니다. 이 애플리케이션은 최대 50명의 동시 사용자까지는 성능이 양호하지만, 사용자 수가 100명을 초과하면서 성능이 크게 저하됩니다. 가장 심각한 문제는 연결 처리와 메모리 누수에 관련된 것으로, 예상되는 사용자 증가를 지원하기 위해 반드시 해결해야 합니다.

## 테스트 결과 분석

### 부하 테스트 성능
![부하 테스트 성능](https://quickchart.io/chart?c=%7B%22type%22%3A%22line%22%2C%22data%22%3A%7B%22labels%22%3A%5B10%2C50%2C100%2C200%2C300%2C400%2C500%2C600%2C700%2C800%2C900%2C1000%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Response%20Time%20(ms)%22%2C%22data%22%3A%5B150%2C300%2C450%2C800%2C1200%2C1800%2C2400%2C3000%2C3500%2C3800%2C4000%2C4200%5D%2C%22backgroundColor%22%3A%22rgba(75%2C%20192%2C%20192%2C%200.2)%22%2C%22borderColor%22%3A%22rgb(75%2C%20192%2C%20192)%22%7D%2C%7B%22label%22%3A%22Failure%20Rate%20(%25)%22%2C%22data%22%3A%5B0%2C0%2C1%2C2%2C3%2C5%2C7%2C8%2C8.5%2C9%2C9.2%2C9.3%5D%2C%22backgroundColor%22%3A%22rgba(255%2C%2099%2C%20132%2C%200.2)%22%2C%22borderColor%22%3A%22rgb(255%2C%2099%2C%20132)%22%7D%5D%7D%2C%22options%22%3A%7B%22scales%22%3A%7B%22y%22%3A%7B%22type%22%3A%22linear%22%2C%22display%22%3Atrue%2C%22position%22%3A%22left%22%2C%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Response%20Time%20(ms)%22%7D%7D%2C%22y1%22%3A%7B%22type%22%3A%22linear%22%2C%22display%22%3Atrue%2C%22position%22%3A%22right%22%2C%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Failure%20Rate%20(%25)%22%7D%7D%2C%22x%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Virtual%20Users%22%7D%7D%7D%2C%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Load%20Test%20Performance%22%7D%7D%7D)

**주요 발견사항:**
- 최대 100명의 사용자까지는 응답 시간이 500ms 이하로 유지됨
- 200명 이상의 사용자에서는 응답 시간이 기하급수적으로 증가함
- 실패율은 100명 사용자부터 나타나기 시작하여 1000명에서 약 9%까지 증가함
- 약 300명의 사용자에서 중요한 성능 임계점이 발생함

### WebSocket 메시지 홍수 테스트
![WebSocket 메시지 홍수 테스트](https://quickchart.io/chart?c=%7B%22type%22%3A%22line%22%2C%22data%22%3A%7B%22labels%22%3A%5B10%2C50%2C100%2C150%2C200%2C250%2C300%2C350%2C400%2C450%2C500%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Message%20Delivery%20(%25)%22%2C%22data%22%3A%5B100%2C98%2C95%2C90%2C86%2C80%2C75%2C70%2C65%2C60%2C50%5D%2C%22backgroundColor%22%3A%22rgba(54%2C%20162%2C%20235%2C%200.2)%22%2C%22borderColor%22%3A%22rgb(54%2C%20162%2C%20235)%22%7D%2C%7B%22label%22%3A%22Connection%20Stability%20(%25)%22%2C%22data%22%3A%5B100%2C100%2C98%2C95%2C90%2C85%2C80%2C75%2C70%2C65%2C60%5D%2C%22backgroundColor%22%3A%22rgba(255%2C%20159%2C%2064%2C%200.2)%22%2C%22borderColor%22%3A%22rgb(255%2C%20159%2C%2064)%22%7D%5D%7D%2C%22options%22%3A%7B%22scales%22%3A%7B%22y%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Performance%20(%25)%22%7D%2C%22min%22%3A0%2C%22max%22%3A100%7D%2C%22x%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Virtual%20Users%22%7D%7D%7D%2C%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22WebSocket%20Message%20Flood%20Test%22%7D%7D%7D)

**주요 발견사항:**
- 메시지 전달 속도는 100명 이상의 사용자에서 현저하게 감소하기 시작함
- 500명의 동시 사용자에서는 메시지의 50%만 안정적으로 전달됨
- 연결 안정성은 메시지 전달과 함께 감소함
- 500명의 사용자에서는 연결의 40%가 불안정성이나 끊김을 경험함

### WebSocket 재연결 테스트
![WebSocket 재연결 테스트](https://quickchart.io/chart?c=%7B%22type%22%3A%22line%22%2C%22data%22%3A%7B%22labels%22%3A%5B1%2C2%2C3%2C4%2C5%2C6%2C7%2C8%2C9%2C10%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Reconnect%20Success%20(%25)%22%2C%22data%22%3A%5B100%2C100%2C100%2C98%2C96%2C94%2C90%2C86%2C82%2C76%5D%2C%22backgroundColor%22%3A%22rgba(153%2C%20102%2C%20255%2C%200.2)%22%2C%22borderColor%22%3A%22rgb(153%2C%20102%2C%20255)%22%7D%2C%7B%22label%22%3A%22Reconnect%20Time%20(ms)%22%2C%22data%22%3A%5B120%2C150%2C200%2C350%2C500%2C800%2C1200%2C1800%2C2500%2C3200%5D%2C%22backgroundColor%22%3A%22rgba(201%2C%20203%2C%20207%2C%200.2)%22%2C%22borderColor%22%3A%22rgb(201%2C%20203%2C%20207)%22%7D%5D%7D%2C%22options%22%3A%7B%22scales%22%3A%7B%22y%22%3A%7B%22type%22%3A%22linear%22%2C%22display%22%3Atrue%2C%22position%22%3A%22left%22%2C%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Success%20Rate%20(%25)%22%7D%2C%22min%22%3A0%2C%22max%22%3A100%7D%2C%22y1%22%3A%7B%22type%22%3A%22linear%22%2C%22display%22%3Atrue%2C%22position%22%3A%22right%22%2C%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Reconnect%20Time%20(ms)%22%7D%7D%2C%22x%22%3A%7B%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Virtual%20Users%22%7D%7D%7D%2C%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22WebSocket%20Reconnect%20Test%22%7D%7D%7D)

**주요 발견사항:**
- 단 10개의 동시 재연결에서도 재연결 성공률이 76%로 하락함
- 재연결 시간이 기하급수적으로 증가하여 10명의 사용자에서 3.2초에 도달함
- 서버가 재연결 급증을 처리하는 데 어려움을 겪음
- 재연결 메커니즘이 적절하게 확장되지 않음

### 성능 문제 심각도
![성능 문제 심각도](https://quickchart.io/chart?c=%7B%22type%22%3A%22radar%22%2C%22data%22%3A%7B%22labels%22%3A%5B%22Memory%20Leaks%22%2C%22Connection%20Handling%22%2C%22Message%20Queuing%22%2C%22CPU%20Bottlenecks%22%2C%22DB%20Access%22%5D%2C%22datasets%22%3A%5B%7B%22label%22%3A%22Severity%20(0-10)%22%2C%22data%22%3A%5B8%2C9%2C6%2C7%2C4%5D%2C%22backgroundColor%22%3A%22rgba(255%2C%2099%2C%20132%2C%200.2)%22%2C%22borderColor%22%3A%22rgb(255%2C%2099%2C%20132)%22%7D%5D%7D%2C%22options%22%3A%7B%22scale%22%3A%7B%22ticks%22%3A%7B%22beginAtZero%22%3Atrue%2C%22max%22%3A10%7D%7D%2C%22elements%22%3A%7B%22line%22%3A%7B%22tension%22%3A0%2C%22borderWidth%22%3A3%7D%7D%2C%22title%22%3A%7B%22display%22%3Atrue%2C%22text%22%3A%22Performance%20Issue%20Severity%22%7D%7D%7D)

**주요 발견사항:**
- 연결 처리가 가장 심각한 문제 (9/10)
- 메모리 누수가 중요한 우려사항 (8/10)
- 높은 부하에서의 CPU 병목 현상 (7/10)
- 메시지 큐잉 최적화 필요 (6/10)
- 데이터베이스 접근 성능은 덜 중요함 (4/10)

## 백엔드 문제 및 권장사항

### 1. 연결 처리 문제 (심각도: 9/10)

**문제점:**
- WebSocket 서버가 증가하는 연결에 따라 적절하게 확장되지 않음
- 연결 풀링이나 제한이 구현되어 있지 않음
- 각 연결이 적절한 정리 없이 상당한 리소스를 소비함

**권장사항:**
- WebSocket 게이트웨이에 연결 풀링 구현
- 연결 제한 및 스로틀링 추가
- 피크 부하에 대한 단계적 성능 저하 구현

```typescript
// chat.gateway.ts에서
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  // 이 설정 추가
  transports: ['websocket'],
  pingInterval: 10000,
  pingTimeout: 5000,
  connectTimeout: 10000,
  maxHttpBufferSize: 1e6, // 1MB
})
```

- 수평적 확장을 위한 Redis 어댑터 추가:

```typescript
// gateway.module.ts에서
import { RedisIoAdapter } from './redis-io.adapter';

@Module({
  imports: [
    // 소켓 확장을 위한 Redis 추가
    ConfigModule,
    // 기타 임포트
  ],
  providers: [
    ChatGateway,
    // 기타 프로바이더
  ],
})
export class GatewayModule implements OnModuleInit {
  constructor(private readonly adapterConstructor: RedisIoAdapter) {}

  onModuleInit() {
    this.adapterConstructor.connectToRedis();
  }
}
```

### 2. 메모리 누수 (심각도: 8/10)

**문제점:**
- 소켓 인스턴스가 연결 해제 후 제대로 삭제되지 않음
- 세션 종료 후에도 이벤트 핸들러가 등록된 상태로 남아있음
- 비활성 연결에 대한 가비지 수집 전략이 없음

**권장사항:**
- handleDisconnect 메서드의 메모리 누수 수정
- 소켓 이벤트에서 적절한 정리 구현
- 서버 측 세션 타임아웃 관리 추가

```typescript
// chat.gateway.ts에서
@SubscribeMessage('disconnect')
async handleDisconnect(client: Socket) {
  try {
    // 모든 리소스의 적절한 정리
    const user = this.connectedUsers.get(client.id);
    if (user) {
      // 모든 방, 채널 등에서 제거
      await this.chatService.handleUserDisconnect(user.id);
      this.connectedUsers.delete(client.id);
      
      // 모든 이벤트 리스너 해제
      client.removeAllListeners();
      
      // 성공적인 정리 로깅
      this.logger.log(`클라이언트 연결 해제됨: ${client.id}`);
    }
  } catch (error) {
    this.logger.error(`연결 해제 중 오류: ${error.message}`, error.stack);
  }
}
```

### 3. 메시지 큐잉 (심각도: 6/10)

**문제점:**
- 메시지가 동기적으로 처리되어 이벤트 루프를 차단함
- 메시지 전송에 대한 속도 제한이 없음
- 높은 부하에서 메시지 백로그를 처리하기 위한 큐가 없음

**권장사항:**
- 메시지 큐 구현 (RabbitMQ 또는 Bull)
- 사용자/연결별 속도 제한 추가
- 백프레셔 처리 구현

```typescript
// main.ts에서
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  // 전역 속도 제한 추가
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: 100, // REST 엔드포인트에 대해 windowMs당 각 IP를 100개 요청으로 제한
    }),
  );
  
  await app.listen(3000);
}
```

```typescript
// chat.gateway.ts에서 - 메시지 속도 제한 추가
@SubscribeMessage('sendMessage')
@RateLimit({
  keyPrefix: 'send-message',
  points: 10, // 10개 메시지
  duration: 60, // 분당
  errorMessage: '너무 많은 메시지를 보냈습니다. 속도를 늦춰주세요.',
})
async handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
  // 메시지 처리 로직
}
```

### 4. CPU 병목 현상 (심각도: 7/10)

**문제점:**
- 단일 스레드 이벤트 루프가 과부하됨
- CPU 집약적 작업을 위한 워커 스레드가 없음
- 비효율적인 메시지 브로드캐스팅 알고리즘

**권장사항:**
- CPU 집약적 작업을 위한 워커 스레드 구현
- 대규모 룸을 위한 브로드캐스트 알고리즘 최적화
- 서버 전체가 아닌 룸 기반 선택적 브로드캐스팅 사용

```typescript
// chat.gateway.ts에서 - 브로드캐스팅 최적화
async broadcastToRoom(roomId: string, event: string, data: any) {
  // 모든 연결된 클라이언트에 브로드캐스트하는 대신
  // this.server.emit('message', data);
  
  // 룸 멤버에게만 선택적으로 브로드캐스트
  this.server.to(roomId).emit(event, data);
}
```

## 결론

WebSocket 채팅 애플리케이션은 소규모에서는 양호한 성능을 보이지만 사용자 수가 증가함에 따라 상당한 도전에 직면합니다. 특히 연결 처리와 메모리 관리 관련 권장 변경사항을 구현함으로써, 애플리케이션은 수용 가능한 성능으로 500명 이상의 동시 사용자를 지원할 수 있을 것입니다.

성능 테스트에서 확인된 가장 중요한 병목 현상인 연결 처리 문제와 메모리 누수를 먼저 해결하는 것을 우선시하세요. 