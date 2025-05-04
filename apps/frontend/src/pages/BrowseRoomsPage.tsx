import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../api/chatService';
import Avatar from '../components/Common/Avatar';

const BrowseRoomsPage = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Fetch public rooms
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['publicRooms', page, limit, searchText],
    queryFn: async () => {
      // Assume the API supports pagination and search params
      return await chatService.getPublicRooms({
        page,
        limit,
        search: searchText
      });
    },
  });

  const handleJoinRoom = async (roomId: number) => {
    try {
      // Assuming there's a joinRoom method in chatService
      await chatService.joinRoom(roomId);
      navigate(`/chat/${roomId}`);
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  const handleCreateRoom = () => {
    navigate('/chat/create');
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Browse Public Rooms</h1>
        <button
          onClick={handleCreateRoom}
          className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-dark"
        >
          Create Room
        </button>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search rooms..."
            className="w-full rounded-l-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="rounded-r-md bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Search
          </button>
        </div>
      </form>

      {/* Error State */}
      {error && (
        <div className="mb-4 rounded-md bg-red-100 p-4 text-red-800">
          <p>Failed to load rooms. Please try again.</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      )}

      {/* No Results */}
      {!isLoading && data?.items.length === 0 && (
        <div className="rounded-md bg-gray-100 p-8 text-center">
          <p className="text-gray-500">No public rooms found.</p>
          <button
            onClick={handleCreateRoom}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Create a New Room
          </button>
        </div>
      )}

      {/* Room List */}
      {!isLoading && data?.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((room) => (
            <div key={room.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="mr-3">
                    <Avatar src={room.imageUrl} name={room.name} size="md" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{room.name}</h3>
                    {room.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{room.description}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {room.userCount || 0} members
                  </div>
                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    className="rounded-md bg-primary px-4 py-1 text-sm text-white hover:bg-primary-dark"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {data.meta.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(data.meta.totalPages, page + 1))}
              disabled={page === data.meta.totalPages}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default BrowseRoomsPage; 