import { format } from 'date-fns';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Room, useChatStore } from '../../store/chatStore';
import Avatar from '../Common/Avatar';

interface RoomListProps {
  rooms: Room[];
  onSelectRoom?: () => void;
}

const RoomList: React.FC<RoomListProps> = ({ rooms, onSelectRoom }) => {
  const navigate = useNavigate();
  const { currentRoomId, setCurrentRoom } = useChatStore();

  const handleRoomSelect = (room: Room) => {
    setCurrentRoom(room.id);
    navigate(`/chat/${room.id}`);
    onSelectRoom?.();
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    
    // If today, show time, otherwise show date
    const today = new Date();
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return format(date, 'HH:mm');
    }
    
    // If this year, show day and month
    if (date.getFullYear() === today.getFullYear()) {
      return format(date, 'MMM d');
    }
    
    // Otherwise show day, month and year
    return format(date, 'MM/dd/yy');
  };

  // Get the other user in a 1:1 chat
  const getOtherUser = (room: Room) => {
    if (room.isGroup) return null;
    return room.users[0] || null;
  };

  // Get room display name
  const getRoomDisplayName = (room: Room) => {
    if (room.name) return room.name;
    if (!room.isGroup) {
      const otherUser = getOtherUser(room);
      return otherUser?.nickname || 'Unknown User';
    }
    return 'Chat';
  };

  if (rooms.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        No chats yet. Start a new conversation!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rooms.map((room) => {
        const otherUser = getOtherUser(room);
        const isActive = currentRoomId === room.id;
        
        return (
          <div
            key={room.id}
            className={`cursor-pointer rounded-md px-3 py-2 transition-colors ${
              isActive
                ? 'bg-primary-50 text-primary-800'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => handleRoomSelect(room)}
          >
            <div className="flex items-center">
              {room.isGroup ? (
                <div className="relative">
                  <div className="flex -space-x-2">
                    {room.users.slice(0, 3).map((user) => (
                      <Avatar
                        key={user.id}
                        src={user.imageUrl}
                        name={user.nickname}
                        size="sm"
                        className="ring-2 ring-white"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <Avatar
                  src={otherUser?.imageUrl}
                  name={otherUser?.nickname || 'User'}
                  size="md"
                  status={otherUser?.presence}
                />
              )}

              <div className="ml-3 flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h3 className="truncate font-medium">
                    {getRoomDisplayName(room)}
                  </h3>
                  {room.lastMessage && (
                    <span className="text-xs text-gray-400">
                      {formatTime(room.lastMessage.insertedAt)}
                    </span>
                  )}
                </div>
                
                <p className="truncate text-sm text-gray-500">
                  {room.lastMessage?.content || 'No messages yet'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoomList; 