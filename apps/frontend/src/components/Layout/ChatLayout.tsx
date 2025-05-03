import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { chatService } from '../../api/chatService';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import RoomList from '../Chat/RoomList';
import Avatar from '../Common/Avatar';

const ChatLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { setRooms } = useChatStore();
  const { socket } = useSocket();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Fetch rooms
  const { data: rooms, isLoading, error } = useQuery({
    queryKey: ['rooms'],
    queryFn: chatService.getRooms,
  });

  useEffect(() => {
    if (rooms) {
      setRooms(rooms);
    }
  }, [rooms, setRooms]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile Sidebar Toggle */}
      <button
        className="fixed left-4 top-4 z-20 rounded-md bg-white p-2 shadow-md lg:hidden"
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-10 w-80 transform bg-white p-4 shadow-md transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Chats</h1>
            
            {/* Connection Status */}
            <div className="flex items-center">
              <div 
                className={`mr-2 h-2 w-2 rounded-full ${
                  socket?.connected ? 'bg-green-500' : 'bg-red-500'
                }`} 
              />
              <span className="text-xs text-gray-500">
                {socket?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="py-4 text-center text-sm text-red-500">
                Failed to load chats
              </div>
            ) : (
              <RoomList rooms={rooms || []} onSelectRoom={() => setIsMobileSidebarOpen(false)} />
            )}
          </div>
          
          {/* User Profile */}
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="flex items-center">
              <Avatar 
                src={user?.imageUrl} 
                name={user?.nickname || 'User'} 
                size="md" 
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">{user?.nickname}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

export default ChatLayout; 