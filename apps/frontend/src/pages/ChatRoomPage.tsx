import { CreateMessageRequest, MessageResponse } from '@chat-example/types';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { chatService } from '../api/chatService';
import { useAuthStore } from '../store/authStore';

const ChatRoomPage = () => {
  const { roomId } = useParams();
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch messages from API
  useEffect(() => {
    const fetchMessages = async () => {
      if (!roomId) return;

      setLoading(true);
      try {
        const roomIdNumber = parseInt(roomId);
        const response = await chatService.getMessages(roomIdNumber);
        console.log('API Response:', response);
        // Set messages directly since the API now returns an array
        setMessages(response || []);
        console.log('Messages set to:', response || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [roomId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !roomId || !user) return;
    
    const messageRequest: CreateMessageRequest = {
      content: newMessage,
      roomId: parseInt(roomId)
    };
    
    // Optimistically add message to UI
    const optimisticMessage: MessageResponse = {
      id: Date.now(), // Temporary ID, will be replaced by server's ID
      content: newMessage,
      roomId: parseInt(roomId),
      senderId: user.id,
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      isDeleted: false,
      sender: {
        id: user.id,
        nickname: user.nickname,
        imageUrl: user.imageUrl
      },
      reactions: [],
      mentions: [],
      replyCount: 0
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    
    try {
      // Send message to API
      await chatService.createMessage(parseInt(roomId), newMessage);
      
      // Could refresh messages here to get the accurate server data
      // but we'll skip for now to avoid the extra API call
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
    }
  };

  // Function to format timestamps
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const currentUserId = user?.id;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-semibold">
          {roomId ? `Chat Room #${roomId}` : 'General Chat'}
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(message => (
              <div 
                key={message.id} 
                className={`flex ${message.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.senderId === currentUserId 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.senderId !== currentUserId && (
                    <div className="mb-1 text-xs font-semibold">{message.sender.nickname}</div>
                  )}
                  <div>{message.content}</div>
                  <div className="mt-1 text-right text-xs opacity-70">
                    {formatTime(message.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="rounded-md bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatRoomPage; 