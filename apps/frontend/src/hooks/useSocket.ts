import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { Message, Reaction, useChatStore } from '../store/chatStore';

interface MessageResponse {
  error?: string;
  id?: number;
  roomId?: number;
  content?: string;
  senderId?: number;
  insertedAt?: string;
}

interface ReactionResponse {
  error?: string;
  success?: boolean;
  added?: boolean;
  reaction?: Reaction;
}

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const token = useAuthStore(state => state.token);
  
  const addMessage = useChatStore(state => state.addMessage);
  const updateMessage = useChatStore(state => state.updateMessage);
  const deleteMessage = useChatStore(state => state.deleteMessage);
  const addReaction = useChatStore(state => state.addReaction);
  const removeReaction = useChatStore(state => state.removeReaction);
  const setPresence = useChatStore(state => state.setPresence);
  
  useEffect(() => {
    if (!token) return;
    
    // Initialize socket connection
    const socket = io(import.meta.env.VITE_API_URL || window.location.origin, {
      extraHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });
    
    socket.on('disconnect', () => {
      console.log('Socket connection closed');
    });
    
    socket.on('new_message', (message: Message) => {
      addMessage(message.roomId, message);
    });
    
    socket.on('message_updated', (message: Message) => {
      updateMessage(message.id, message.content);
    });
    
    socket.on('message_deleted', (messageId: number) => {
      deleteMessage(messageId);
    });
    
    socket.on('reaction_updated', ({ messageId, reactions }: { messageId: number, reactions: Reaction[] }) => {
      // Clear existing reactions and add new ones
      reactions.forEach(reaction => {
        addReaction(messageId, reaction);
      });
    });
    
    socket.on('user_presence', ({ userId, status }: { userId: number, status: 'online' | 'offline' }) => {
      setPresence(userId, status);
    });
    
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, addMessage, updateMessage, deleteMessage, addReaction, setPresence]);
  
  const joinRoom = useCallback((roomId: number) => {
    return new Promise<boolean>((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      socketRef.current.emit('join_room', { roomId }, (response: { success?: boolean, error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(!!response.success);
        }
      });
    });
  }, []);
  
  const sendMessage = useCallback((roomId: number, content: string, parentId?: number) => {
    return new Promise<Message>((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      socketRef.current.emit(
        'new_message', 
        { roomId, content, parentId },
        (response: MessageResponse) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response as Message);
          }
        }
      );
    });
  }, []);
  
  const editMessage = useCallback((messageId: number, content: string) => {
    return new Promise<Message>((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      socketRef.current.emit(
        'edit_message',
        { messageId, content },
        (response: MessageResponse) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response as Message);
          }
        }
      );
    });
  }, []);
  
  const reactToMessage = useCallback((messageId: number, emoji: string) => {
    return new Promise<{ added: boolean, reaction?: Reaction }>((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      socketRef.current.emit('react_message', { messageId, emoji }, (response: ReactionResponse) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve({
            added: !!response.added,
            reaction: response.reaction
          });
        }
      });
    });
  }, []);
  
  return {
    socket: socketRef.current,
    joinRoom,
    sendMessage,
    editMessage,
    reactToMessage,
    connected: !!socketRef.current?.connected,
  };
}; 