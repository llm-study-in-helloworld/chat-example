import {
  MessageResponse,
  ReactionResponse,
  RoomResponse,
} from "@chat-example/types";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// Define a Room type for use in the frontend
export interface Room {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  isPrivate: boolean;
  isDirect: boolean;
  isGroup: boolean;
  isActive: boolean;
  ownerId: number;
  otherUser?: {
    id: number;
    nickname: string;
    imageUrl?: string;
    presence?: "online" | "offline";
  };
  users: Array<{
    id: number;
    nickname: string;
    imageUrl?: string;
    presence?: "online" | "offline";
  }>;
  lastMessage?: {
    id: number;
    content: string;
    senderId: number;
    insertedAt: string;
    isDeleted?: boolean;
  };
  unreadCount?: number;
}

interface ChatStore {
  // State
  rooms: Room[];
  currentRoomId: number | null;
  messages: Record<number, MessageResponse[]>;
  reactions: Record<number, ReactionResponse[]>;
  presence: Record<number, "online" | "offline">;

  // Actions
  setRooms: (rooms: RoomResponse[]) => void;
  setCurrentRoom: (roomId: number | null) => void;
  addMessage: (roomId: number, message: MessageResponse) => void;
  updateMessage: (messageId: number, content: string) => void;
  deleteMessage: (messageId: number) => void;
  setMessages: (roomId: number, messages: MessageResponse[]) => void;
  addReaction: (messageId: number, reaction: ReactionResponse) => void;
  removeReaction: (messageId: number, reactionId: number) => void;
  setPresence: (userId: number, status: "online" | "offline") => void;
}

export const useChatStore = create<ChatStore>()(
  immer((set) => ({
    rooms: [],
    currentRoomId: null,
    messages: {},
    reactions: {},
    presence: {},

    setRooms: (rooms) =>
      set((state) => {
        // Map RoomResponse to our Room interface
        state.rooms = rooms.map((room) => ({
          id: room.id,
          name: room.name || "",
          description: room.description,
          imageUrl: room.imageUrl,
          isPrivate: room.isPrivate,
          isDirect: room.isDirect || false,
          isGroup: !room.isDirect,
          isActive: room.isActive !== false, // Default to true if not specified
          ownerId: room.ownerId,
          otherUser: (room as any).otherUser,
          users: (room as any).users || [],
          lastMessage: (room as any).lastMessage,
          unreadCount: room.unreadCount || 0,
        }));
      }),

    setCurrentRoom: (roomId) =>
      set((state) => {
        state.currentRoomId = roomId;
      }),

    addMessage: (roomId, message) =>
      set((state) => {
        if (!state.messages[roomId]) {
          state.messages[roomId] = [];
        }
        state.messages[roomId].push(message);

        // Also update the lastMessage in the corresponding room
        const roomIndex = state.rooms.findIndex((r) => r.id === roomId);
        if (roomIndex !== -1) {
          state.rooms[roomIndex].lastMessage = {
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            insertedAt: message.createdAt,
            isDeleted: message.isDeleted,
          };
        }
      }),

    updateMessage: (messageId, content) =>
      set((state) => {
        for (const roomId in state.messages) {
          const index = state.messages[roomId].findIndex(
            (m) => m.id === messageId,
          );
          if (index !== -1) {
            state.messages[roomId][index].content = content;
            state.messages[roomId][index].updatedAt = new Date().toISOString();
            break;
          }
        }
      }),

    deleteMessage: (messageId) =>
      set((state) => {
        for (const roomId in state.messages) {
          const index = state.messages[roomId].findIndex(
            (m) => m.id === messageId,
          );
          if (index !== -1) {
            state.messages[roomId][index].deletedAt = new Date().toISOString();
            state.messages[roomId][index].isDeleted = true;
            break;
          }
        }
      }),

    setMessages: (roomId, messages) =>
      set((state) => {
        state.messages[roomId] = messages;
      }),

    addReaction: (messageId, reaction) =>
      set((state) => {
        if (!state.reactions[messageId]) {
          state.reactions[messageId] = [];
        }
        state.reactions[messageId].push(reaction);

        // Also update reaction in the message if it exists
        for (const roomId in state.messages) {
          const messageIndex = state.messages[roomId].findIndex(
            (m) => m.id === messageId,
          );
          if (messageIndex !== -1) {
            if (!state.messages[roomId][messageIndex].reactions) {
              state.messages[roomId][messageIndex].reactions = [];
            }
            state.messages[roomId][messageIndex].reactions?.push(reaction);
            break;
          }
        }
      }),

    removeReaction: (messageId, reactionId) =>
      set((state) => {
        if (state.reactions[messageId]) {
          state.reactions[messageId] = state.reactions[messageId].filter(
            (r) => r.id !== reactionId,
          );
        }

        // Also remove reaction from the message if it exists
        for (const roomId in state.messages) {
          const messageIndex = state.messages[roomId].findIndex(
            (m) => m.id === messageId,
          );
          if (
            messageIndex !== -1 &&
            state.messages[roomId][messageIndex].reactions
          ) {
            state.messages[roomId][messageIndex].reactions = state.messages[
              roomId
            ][messageIndex].reactions?.filter((r) => r.id !== reactionId);
            break;
          }
        }
      }),

    setPresence: (userId, status) =>
      set((state) => {
        state.presence[userId] = status;

        // Update user presence in rooms
        state.rooms.forEach((room, roomIndex) => {
          // Update presence in otherUser if it matches
          if (room.otherUser && room.otherUser.id === userId) {
            state.rooms[roomIndex].otherUser!.presence = status;
          }

          // Update presence in users array
          const userIndex = room.users.findIndex((u) => u.id === userId);
          if (userIndex !== -1) {
            state.rooms[roomIndex].users[userIndex].presence = status;
          }
        });
      }),
  })),
);
