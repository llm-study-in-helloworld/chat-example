import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { chatService } from "../../api/chatService";
import { useSocket } from "../../hooks/useSocket";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import RoomList from "../Chat/RoomList";
import Avatar from "../Common/Avatar";

const ChatLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { setRooms } = useChatStore();
  const { socket } = useSocket();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Fetch rooms
  const {
    data: rooms,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["rooms"],
    queryFn: chatService.getRooms,
  });

  useEffect(() => {
    if (rooms) {
      setRooms(rooms);
    }
  }, [rooms, setRooms]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleCreateRoom = () => {
    navigate("/chat/create");
    setIsMobileSidebarOpen(false);
  };

  const handleBrowseRooms = () => {
    navigate("/chat/browse");
    setIsMobileSidebarOpen(false);
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
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
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
                  socket?.connected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-xs text-gray-500">
                {socket?.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mb-4 flex space-x-2">
            <button
              onClick={handleCreateRoom}
              className="flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New
            </button>

            <button
              onClick={handleBrowseRooms}
              className="flex flex-1 items-center justify-center rounded-md bg-gray-100 px-3 py-2 text-gray-700 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              Browse
            </button>
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
              <RoomList
                rooms={rooms || []}
                onSelectRoom={() => setIsMobileSidebarOpen(false)}
              />
            )}
          </div>

          {/* User Profile */}
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="relative flex items-center">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center focus:outline-none"
              >
                <Avatar
                  src={user?.imageUrl}
                  name={user?.nickname || "User"}
                  size="md"
                />
                <div className="ml-3">
                  <p className="font-medium text-gray-900">{user?.nickname}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-1 text-gray-400"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                  <button
                    onClick={() => {
                      navigate("/profile");
                      setUserMenuOpen(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2 text-gray-500"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    Profile
                  </button>

                  <button
                    onClick={() => {
                      navigate("/settings/security");
                      setUserMenuOpen(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2 text-gray-500"
                    >
                      <rect
                        x="3"
                        y="11"
                        width="18"
                        height="11"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Security
                  </button>

                  <button
                    onClick={() => {
                      handleLogout();
                      setUserMenuOpen(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2 text-gray-500"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
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
