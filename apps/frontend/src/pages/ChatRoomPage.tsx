import { CreateMessageRequest, MessageResponse, MessageUser } from '@chat-example/types';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const ChatRoomPage = () => {
  const { roomId } = useParams();
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Mock user data
  const currentUser: MessageUser = {
    id: 1,
    nickname: 'CurrentUser',
    imageUrl: null
  };

  // Mock data for demonstration
  useEffect(() => {
    // Simulate loading messages from API
    const fetchMessages = async () => {
      setLoading(true);
      try {
        // In a real app, fetch messages from your API
        const mockMessages: MessageResponse[] = [
          {
            id: 1,
            content: 'Hello there!',
            roomId: parseInt(roomId || '1'),
            senderId: 2,
            parentId: null,
            createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            deletedAt: null,
            isDeleted: false,
            sender: { id: 2, nickname: 'Alice', imageUrl: null },
            reactions: [],
            mentions: []
          },
          {
            id: 2,
            content: 'Hi Alice! How are you?',
            roomId: parseInt(roomId || '1'),
            senderId: 1,
            parentId: null,
            createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
            updatedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
            deletedAt: null,
            isDeleted: false,
            sender: { id: 1, nickname: 'CurrentUser', imageUrl: null },
            reactions: [],
            mentions: []
          },
          {
            id: 3,
            content: 'I\'m doing great! How about you?',
            roomId: parseInt(roomId || '1'),
            senderId: 2,
            parentId: null,
            createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
            updatedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
            deletedAt: null,
            isDeleted: false,
            sender: { id: 2, nickname: 'Alice', imageUrl: null },
            reactions: [],
            mentions: []
          }
        ];
        
        // Simulate network delay
        setTimeout(() => {
          setMessages(mockMessages);
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error fetching messages:', error);
        setLoading(false);
      }
    };

    fetchMessages();
  }, [roomId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    const messageRequest: CreateMessageRequest = {
      content: newMessage,
      roomId: parseInt(roomId || '1')
    };
    
    // Create a new message
    const message: MessageResponse = {
      id: Date.now(),
      content: newMessage,
      roomId: parseInt(roomId || '1'),
      senderId: currentUser.id,
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      isDeleted: false,
      sender: currentUser,
      reactions: [],
      mentions: []
    };
    
    // Add to messages
    setMessages(prev => [...prev, message]);
    
    // Clear input
    setNewMessage('');
    
    // In a real app, send the message to your API
    // Example: api.sendMessage(messageRequest);
  };

  // Function to format timestamps
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
                className={`flex ${message.sender.id === currentUser.id ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.sender.id === currentUser.id 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.sender.id !== currentUser.id && (
                    <div className="mb-1 text-xs font-semibold">{message.sender.nickname}</div>
                  )}
                  <div>{message.content}</div>
                  <div className="mt-1 text-right text-xs opacity-70">
                    {formatTime(message.createdAt)}
                  </div>
                </div>
              </div>
            ))}
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