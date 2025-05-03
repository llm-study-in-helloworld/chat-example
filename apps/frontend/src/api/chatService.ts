import { Message, Reaction, Room } from '../store/chatStore';
import apiClient from './apiClient';

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export const chatService = {
  getRooms: async (): Promise<Room[]> => {
    const { data } = await apiClient.get<Room[]>('/rooms');
    return data;
  },
  
  getRoom: async (roomId: number): Promise<Room> => {
    const { data } = await apiClient.get<Room>(`/rooms/${roomId}`);
    return data;
  },
  
  createRoom: async (userIds: number[], name?: string): Promise<Room> => {
    const { data } = await apiClient.post<Room>('/rooms', { 
      userIds, 
      name,
      isGroup: !!name
    });
    return data;
  },
  
  getMessages: async (
    roomId: number, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<PaginatedResponse<Message>> => {
    const { data } = await apiClient.get<PaginatedResponse<Message>>(
      `/rooms/${roomId}/messages`, 
      { params: { limit, offset } }
    );
    return data;
  },
  
  getMessage: async (messageId: number): Promise<Message> => {
    const { data } = await apiClient.get<Message>(`/messages/${messageId}`);
    return data;
  },
  
  createMessage: async (
    roomId: number, 
    content: string, 
    parentId?: number
  ): Promise<Message> => {
    const { data } = await apiClient.post<Message>('/messages', {
      roomId,
      content,
      parentId
    });
    return data;
  },
  
  updateMessage: async (messageId: number, content: string): Promise<Message> => {
    const { data } = await apiClient.put<Message>(`/messages/${messageId}`, { content });
    return data;
  },
  
  deleteMessage: async (messageId: number): Promise<{ success: boolean }> => {
    const { data } = await apiClient.delete<{ success: boolean }>(`/messages/${messageId}`);
    return data;
  },
  
  getReplies: async (messageId: number): Promise<Message[]> => {
    const { data } = await apiClient.get<Message[]>(`/messages/${messageId}/replies`);
    return data;
  },
  
  toggleReaction: async (messageId: number, emoji: string): Promise<Reaction | { success: boolean, removed: boolean }> => {
    const { data } = await apiClient.post<Reaction | { success: boolean, removed: boolean }>(
      `/messages/reaction`, 
      { messageId, emoji }
    );
    return data;
  },
  
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const { data } = await apiClient.post<{ url: string }>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return data;
  },
}; 