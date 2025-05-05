# Backend Directory Structure and Class Relationships

## Directory Structure

```mermaid
graph TD
    Backend[apps/backend] --> Src[src]
    Backend --> Test[test]
    Backend --> Dist[dist]
    Backend --> Logs[logs]
    Backend --> NodeModules[node_modules]
    
    Src --> MainTS[main.ts]
    Src --> AppModule[app.module.ts]
    Src --> MikroORM[mikro-orm.config.ts]
```
``` mermaid
graph TD
    Src --> Auth[auth]
    Src --> Users[users]
    Src --> Rooms[rooms]
    Src --> Messages[messages]
    Src --> Gateway[gateway]
    Src --> Health[health]
    Src --> Logger[logger]
    Src --> DTO[dto]
    Src --> Entities[entities]
    Src --> Migrations[migrations]
``` 

``` mermaid
graph TD
    Auth --> AuthController[auth.controller.ts]
    Auth --> AuthService[auth.service.ts]
    Auth --> AuthModule[auth.module.ts]
    Auth --> TokenBlacklist[token-blacklist.service.ts]
    Auth --> RefreshToken[refresh-token.service.ts]
    Auth --> AuthHelpers[helpers]
    Auth --> AuthStrategies[strategies]
    Auth --> AuthDecorators[decorators]
    Auth --> AuthGuards[guards]
```

``` mermaid
graph TD 
    Users --> UsersController[users.controller.ts]
    Users --> UsersService[users.service.ts]
    Users --> UsersModule[users.module.ts]
    Users --> UsersDTO[dto]
```

``` mermaid
graph TD
    Rooms --> RoomsController[rooms.controller.ts]
    Rooms --> RoomsService[rooms.service.ts]
    Rooms --> RoomsModule[rooms.module.ts]
    Rooms --> RoomsDTO[dto]
```

``` mermaid
graph TD
    Messages --> MessagesController[messages.controller.ts]
    Messages --> MessagesService[messages.service.ts]
    Messages --> MessagesModule[messages.module.ts]
    Messages --> MessagesDTO[dto]
```

``` mermaid
graph TD 
    Gateway --> ChatGateway[chat.gateway.ts]
    Gateway --> GatewayModule[gateway.module.ts]
    Gateway --> GatewayDTO[dto]
```

``` mermaid
graph TD
    Entities --> User[User.entity.ts]
    Entities --> Room[Room.entity.ts]
    Entities --> RoomUser[RoomUser.entity.ts]
    Entities --> Message[Message.entity.ts]
    Entities --> MessageReaction[MessageReaction.entity.ts]
    Entities --> Mention[Mention.entity.ts]
    Entities --> RefreshTokenEntity[refresh-token.entity.ts]
    Entities --> CommonEntity[CommonEntity.ts]
```

![Backend Directory Structure](./backend_directory_structure.png)

## Module Dependencies

```mermaid
graph TD
    AppModule --> ConfigModule
    AppModule --> LoggerModule
    AppModule --> MikroOrmModule
    AppModule --> UsersModule
    AppModule --> AuthModule
    AppModule --> RoomsModule
    AppModule --> MessagesModule
    AppModule --> GatewayModule
    AppModule --> HealthModule
    
    AuthModule --> UsersModule
    MessagesModule --> UsersModule
    MessagesModule --> RoomsModule
    RoomsModule --> UsersModule
    GatewayModule --> AuthModule
    GatewayModule --> UsersModule
    GatewayModule --> RoomsModule
    GatewayModule --> MessagesModule
```

![Module Dependencies](./module_dependencies.png)

## Entity Relationships

```mermaid
classDiagram
    CommonEntity <|-- User
    CommonEntity <|-- Room
    CommonEntity <|-- RoomUser
    CommonEntity <|-- Message
    CommonEntity <|-- MessageReaction
    CommonEntity <|-- Mention
    CommonEntity <|-- RefreshToken
    
    User "1" -- "n" RefreshToken : has
    User "1" -- "n" RoomUser : joins
    Room "1" -- "n" RoomUser : contains
    Room "1" -- "n" Message : has
    User "1" -- "n" Message : sends
    Message "1" -- "n" MessageReaction : receives
    Message "1" -- "n" Mention : contains
    User "1" -- "n" Mention : is_mentioned
```

![Entity Relationships](./entity_relationships.png)

## Class Diagrams

### Entity Classes

```mermaid
classDiagram
    class CommonEntity {
        +id: string
        +createdAt: Date
        +updatedAt: Date
    }
    
    class User {
        +username: string
        +email: string
        +password: string
        +messages: Message[]
        +roomUsers: RoomUser[]
        +refreshTokens: RefreshToken[]
        +mentions: Mention[]
    }
    
    class Room {
        +name: string
        +description: string
        +isPrivate: boolean
        +messages: Message[]
        +roomUsers: RoomUser[]
    }
    
    class Message {
        +content: string
        +user: User
        +room: Room
        +reactions: MessageReaction[]
        +mentions: Mention[]
    }
    
    class RoomUser {
        +user: User
        +room: Room
        +role: string
    }
    
    class MessageReaction {
        +type: string
        +message: Message
    }
    
    class Mention {
        +user: User
        +message: Message
    }
    
    class RefreshToken {
        +token: string
        +expiresAt: Date
        +user: User
    }
```

![Entity Classes](./entity_classes.png)

### Service Classes and Dependencies

```mermaid
classDiagram
    class AuthService {
        +login(credentials): Promise~TokenPayload~
        +register(userData): Promise~User~
        +refreshToken(token): Promise~TokenPayload~
        +logout(token): Promise~void~
        +validateUser(username, password): Promise~User~
    }
    
    class UsersService {
        +create(userData): Promise~User~
        +findAll(): Promise~User[]~
        +findOne(id): Promise~User~
        +findByUsername(username): Promise~User~
        +update(id, userData): Promise~User~
        +remove(id): Promise~void~
    }
    
    class RoomsService {
        +create(roomData): Promise~Room~
        +findAll(): Promise~Room[]~
        +findOne(id): Promise~Room~
        +update(id, roomData): Promise~Room~
        +remove(id): Promise~void~
        +addUserToRoom(roomId, userId): Promise~RoomUser~
        +removeUserFromRoom(roomId, userId): Promise~void~
    }
    
    class MessagesService {
        +create(messageData): Promise~Message~
        +findAll(): Promise~Message[]~
        +findByRoom(roomId): Promise~Message[]~
        +findOne(id): Promise~Message~
        +update(id, messageData): Promise~Message~
        +remove(id): Promise~void~
        +addReaction(messageId, reactionData): Promise~MessageReaction~
        +removeReaction(messageId, reactionId): Promise~void~
    }
    
    AuthService --> UsersService : uses
    RoomsService --> UsersService : uses
    MessagesService --> RoomsService : uses
    MessagesService --> UsersService : uses
```

![Service Dependencies](./service_dependencies.png)

### Controller and Service Dependencies

```mermaid
classDiagram
    class AuthController {
        +login(credentials): Promise~TokenPayload~
        +register(userData): Promise~User~
        +refreshToken(token): Promise~TokenPayload~
        +logout(token): Promise~void~
    }
    
    class UsersController {
        +create(userData): Promise~User~
        +findAll(): Promise~User[]~
        +findOne(id): Promise~User~
        +update(id, userData): Promise~User~
        +remove(id): Promise~void~
    }
    
    class RoomsController {
        +create(roomData): Promise~Room~
        +findAll(): Promise~Room[]~
        +findOne(id): Promise~Room~
        +update(id, roomData): Promise~Room~
        +remove(id): Promise~void~
        +addUser(roomId, userId): Promise~RoomUser~
        +removeUser(roomId, userId): Promise~void~
    }
    
    class MessagesController {
        +create(messageData): Promise~Message~
        +findAll(): Promise~Message[]~
        +findByRoom(roomId): Promise~Message[]~
        +findOne(id): Promise~Message~
        +update(id, messageData): Promise~Message~
        +remove(id): Promise~void~
    }
    
    class ChatGateway {
        +handleConnection(client)
        +handleDisconnect(client)
        +joinRoom(client, roomId)
        +leaveRoom(client, roomId)
        +sendMessage(client, messageData)
        +addReaction(client, reactionData)
    }
    
    class AuthService {
    }
    
    class UsersService {
    }
    
    class RoomsService {
    }
    
    class MessagesService {
    }
    
    AuthController --> AuthService : uses
    UsersController --> UsersService : uses
    RoomsController --> RoomsService : uses
    MessagesController --> MessagesService : uses
    ChatGateway --> AuthService : uses
    ChatGateway --> RoomsService : uses
    ChatGateway --> MessagesService : uses
    ChatGateway --> UsersService : uses
```

![Controller Service Dependencies](./controller_service_dependencies.png)

### NestJS Module Relationships

```mermaid
classDiagram
    class AppModule {
    }
    
    class AuthModule {
    }
    
    class UsersModule {
    }
    
    class RoomsModule {
    }
    
    class MessagesModule {
    }
    
    class GatewayModule {
    }
    
    class HealthModule {
    }
    
    class LoggerModule {
    }
    
    AppModule o-- AuthModule : imports
    AppModule o-- UsersModule : imports
    AppModule o-- RoomsModule : imports
    AppModule o-- MessagesModule : imports
    AppModule o-- GatewayModule : imports
    AppModule o-- HealthModule : imports
    AppModule o-- LoggerModule : imports
    
    AuthModule o-- UsersModule : imports
    MessagesModule o-- UsersModule : imports
    MessagesModule o-- RoomsModule : imports
    RoomsModule o-- UsersModule : imports
    GatewayModule o-- AuthModule : imports
    GatewayModule o-- UsersModule : imports
    GatewayModule o-- RoomsModule : imports
    GatewayModule o-- MessagesModule : imports
    
    AuthModule --> AuthService : provides
    AuthModule --> AuthController : provides
    UsersModule --> UsersService : provides
    UsersModule --> UsersController : provides
    RoomsModule --> RoomsService : provides
    RoomsModule --> RoomsController : provides
    MessagesModule --> MessagesService : provides
    MessagesModule --> MessagesController : provides
    GatewayModule --> ChatGateway : provides
```

![Module Relationships](./module_relationships.png)
