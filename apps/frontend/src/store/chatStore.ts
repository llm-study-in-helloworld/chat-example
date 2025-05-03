import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface Message {
  id: number;
  roomId: number;
  senderId: number;
  content: string;
  insertedAt: string;
  updatedAt?: string;
  deletedAt?: string;
  parentId?: number;
  sender?: User;
  reactions?: Reaction[];
  mentions?: Mention[];
}

export interface Reaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  user?: User;
}

export interface Room {
  id: number;
  name?: string;
  isGroup: boolean;
  users: User[];
  lastMessage?: Message;
}

export interface User {
  id: number;
  nickname: string;
  imageUrl?: string;
  presence?: 'online' | 'offline';
}

export interface Mention {
  id: number;
  messageId: number;
  mentionedUserId: number;
  mentionedUser?: User;
}

interface ChatStore {
  // State
  rooms: Room[];
  currentRoomId: number | null;
  messages: Record<number, Message[]>;
  reactions: Record<number, Reaction[]>;
  presence: Record<number, User['presence']>;
  
  // Actions
  setRooms: (rooms: Room[]) => void;
  setCurrentRoom: (roomId: number | null) => void;
  addMessage: (roomId: number, message: Message) => void;
  updateMessage: (messageId: number, content: string) => void;
  deleteMessage: (messageId: number) => void;
  setMessages: (roomId: number, messages: Message[]) => void;
  addReaction: (messageId: number, reaction: Reaction) => void;
  removeReaction: (messageId: number, reactionId: number) => void;
  setPresence: (userId: number, status: User['presence']) => void;
}

export const useChatStore = create<ChatStore>()(
  immer((set) => ({
    rooms: [],
    currentRoomId: null,
    messages: {},
    reactions: {},
    presence: {},
    
    setRooms: (rooms) => set((state) => {
      state.rooms = rooms;
    }),
    
    setCurrentRoom: (roomId) => set((state) => {
      state.currentRoomId = roomId;
    }),
    
    addMessage: (roomId, message) => set((state) => {
      if (!state.messages[roomId]) {
        state.messages[roomId] = [];
      }
      state.messages[roomId].push(message);
      
      // Update lastMessage in room
      const roomIndex = state.rooms.findIndex(r => r.id === roomId);
      if (roomIndex !== -1) {
        state.rooms[roomIndex].lastMessage = message;
      }
    }),
    
    updateMessage: (messageId, content) => set((state) => {
      for (const roomId in state.messages) {
        const index = state.messages[roomId].findIndex(m => m.id === messageId);
        if (index !== -1) {
          state.messages[roomId][index].content = content;
          state.messages[roomId][index].updatedAt = new Date().toISOString();
          break;
        }
      }
    }),
    
    deleteMessage: (messageId) => set((state) => {
      for (const roomId in state.messages) {
        const index = state.messages[roomId].findIndex(m => m.id === messageId);
        if (index !== -1) {
          state.messages[roomId][index].deletedAt = new Date().toISOString();
          break;
        }
      }
    }),
    
    setMessages: (roomId, messages) => set((state) => {
      state.messages[roomId] = messages;
    }),
    
    addReaction: (messageId, reaction) => set((state) => {
      if (!state.reactions[messageId]) {
        state.reactions[messageId] = [];
      }
      state.reactions[messageId].push(reaction);
      
      // Also update reaction in the message if it exists
      for (const roomId in state.messages) {
        const messageIndex = state.messages[roomId].findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          if (!state.messages[roomId][messageIndex].reactions) {
            state.messages[roomId][messageIndex].reactions = [];
          }
          state.messages[roomId][messageIndex].reactions?.push(reaction);
          break;
        }
      }
    }),
    
    removeReaction: (messageId, reactionId) => set((state) => {
      if (state.reactions[messageId]) {
        state.reactions[messageId] = state.reactions[messageId].filter(
          r => r.id !== reactionId
        );
      }
      
      // Also remove reaction from the message if it exists
      for (const roomId in state.messages) {
        const messageIndex = state.messages[roomId].findIndex(m => m.id === messageId);
        if (messageIndex !== -1 && state.messages[roomId][messageIndex].reactions) {
          state.messages[roomId][messageIndex].reactions = 
            state.messages[roomId][messageIndex].reactions?.filter(r => r.id !== reactionId);
          break;
        }
      }
    }),
    
    setPresence: (userId, status) => set((state) => {
      state.presence[userId] = status;
      
      // Update user presence in rooms
      state.rooms.forEach((room, roomIndex) => {
        const userIndex = room.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          state.rooms[roomIndex].users[userIndex].presence = status;
        }
      });
    }),
  }))
); 