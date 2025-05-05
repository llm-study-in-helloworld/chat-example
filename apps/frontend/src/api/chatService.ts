import {
  MessageResponse,
  ReactionResponse,
  RoomResponse,
  RoomUserResponse,
} from "@chat-example/types";
import apiClient from "./apiClient";

interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface RoomQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: "direct" | "group";
}

export interface PaginatedRoomResponse {
  items: RoomResponse[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export const chatService = {
  getRooms: async (): Promise<RoomResponse[]> => {
    const { data } = await apiClient.get<RoomResponse[]>("/rooms");
    return data;
  },

  getRoom: async (roomId: number): Promise<RoomResponse> => {
    const { data } = await apiClient.get<RoomResponse>(`/rooms/${roomId}`);
    return data;
  },

  getPublicRooms: async (
    params: RoomQueryParams,
  ): Promise<PaginatedRoomResponse> => {
    const { data } = await apiClient.get<PaginatedRoomResponse>(
      "/rooms/public",
      {
        params,
      },
    );
    return data;
  },

  joinRoom: async (roomId: number): Promise<RoomResponse> => {
    // Use the join endpoint we created
    const { data } = await apiClient.post<RoomResponse>(
      `/rooms/${roomId}/join`,
    );
    return data;
  },

  leaveRoom: async (roomId: number): Promise<{ success: boolean }> => {
    const { data } = await apiClient.delete<{ success: boolean }>(
      `/rooms/${roomId}/leave`,
    );
    return data;
  },

  getRoomUsers: async (roomId: number): Promise<RoomUserResponse[]> => {
    const { data } = await apiClient.get<RoomUserResponse[]>(
      `/rooms/${roomId}/users`,
    );
    return data;
  },

  addUserToRoom: async (
    roomId: number,
    userId: number,
  ): Promise<{ success: boolean }> => {
    const { data } = await apiClient.post<{ success: boolean }>(
      `/rooms/${roomId}/users`,
      { userId },
    );
    return data;
  },

  removeUserFromRoom: async (
    roomId: number,
    userId: number,
  ): Promise<{ success: boolean }> => {
    const { data } = await apiClient.delete<{ success: boolean }>(
      `/rooms/${roomId}/users/${userId}`,
    );
    return data;
  },

  updateLastSeen: async (roomId: number): Promise<{ success: boolean }> => {
    const { data } = await apiClient.post<{ success: boolean }>(
      `/rooms/${roomId}/seen`,
    );
    return data;
  },

  createRoom: async (
    userIds: number[],
    name?: string,
    isPrivate?: boolean,
    isDirect?: boolean,
  ): Promise<RoomResponse> => {
    const { data } = await apiClient.post<RoomResponse>("/rooms", {
      userIds,
      name,
      isPrivate,
      isDirect,
      isActive: true,
    });
    return data;
  },

  updateRoom: async (
    roomId: number,
    updateData: { name?: string; description?: string; isPrivate?: boolean },
  ): Promise<RoomResponse> => {
    const { data } = await apiClient.patch<RoomResponse>(
      `/rooms/${roomId}`,
      updateData,
    );
    return data;
  },

  getMessages: async (
    roomId: number,
    limit: number = 20,
    offset: number = 0,
  ): Promise<MessageResponse[]> => {
    // Use the correct endpoint structure from the MessagesController
    const { data } = await apiClient.get<MessageResponse[]>(
      `/messages/room/${roomId}`,
      { params: { limit, offset } },
    );
    return data;
  },

  getMessage: async (messageId: number): Promise<MessageResponse> => {
    const { data } = await apiClient.get<MessageResponse>(
      `/messages/${messageId}`,
    );
    return data;
  },

  createMessage: async (
    roomId: number,
    content: string,
    parentId?: number,
  ): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>("/messages", {
      roomId,
      content,
      parentId,
    });
    return data;
  },

  replyToMessage: async (
    roomId: number,
    parentId: number,
    content: string,
  ): Promise<MessageResponse> => {
    const { data } = await apiClient.post<MessageResponse>(
      `/messages/${parentId}/reply`,
      {
        roomId,
        content,
      },
    );
    return data;
  },

  updateMessage: async (
    messageId: number,
    content: string,
  ): Promise<MessageResponse> => {
    const { data } = await apiClient.put<MessageResponse>(
      `/messages/${messageId}`,
      { content },
    );
    return data;
  },

  deleteMessage: async (messageId: number): Promise<{ success: boolean }> => {
    const { data } = await apiClient.delete<{ success: boolean }>(
      `/messages/${messageId}`,
    );
    return data;
  },

  getReplies: async (messageId: number): Promise<MessageResponse[]> => {
    const { data } = await apiClient.get<MessageResponse[]>(
      `/messages/${messageId}/replies`,
    );
    return data;
  },

  toggleReaction: async (
    messageId: number,
    emoji: string,
  ): Promise<ReactionResponse | { success: boolean; removed: boolean }> => {
    const { data } = await apiClient.post<
      ReactionResponse | { success: boolean; removed: boolean }
    >(`/messages/reaction`, { messageId, emoji });
    return data;
  },

  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const { data } = await apiClient.post<{ url: string }>(
      "/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return data;
  },
};
