import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { chatService } from "../api/chatService";
import { useAuthStore } from "../store/authStore";

const CreateRoomPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPrivate: false,
    isDirect: false,
    userIds: [] as number[],
  });

  // Simple user input for now since we don't have a user search API
  const [userIdInput, setUserIdInput] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData({
      ...formData,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    });
  };

  const handleAddUserId = () => {
    const userId = parseInt(userIdInput.trim());
    if (!isNaN(userId) && userId > 0) {
      if (!formData.userIds.includes(userId)) {
        setFormData({
          ...formData,
          userIds: [...formData.userIds, userId],
        });
        setUserIdInput("");
      }
    }
  };

  const handleRemoveUserId = (userId: number) => {
    setFormData({
      ...formData,
      userIds: formData.userIds.filter((id) => id !== userId),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() && !formData.isDirect) {
      setError("Group chats require a name");
      return;
    }

    // Removed the validation for userIds, allowing empty array

    setIsLoading(true);
    setError(null);

    try {
      const response = await chatService.createRoom(
        formData.userIds,
        formData.name,
        formData.isPrivate,
        formData.isDirect,
      );

      // Navigate to the new room
      navigate(`/chat/${response.id}`);
    } catch (error: any) {
      console.error("Error creating room:", error);
      setError(error.response?.data?.message || "Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-2xl font-bold">Create New Chat Room</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-100 p-4 text-red-800">
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Room Type</label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="isDirect"
                  checked={!formData.isDirect}
                  onChange={() => setFormData({ ...formData, isDirect: false })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="ml-2">Group Chat</span>
              </label>

              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="isDirect"
                  checked={formData.isDirect}
                  onChange={() => setFormData({ ...formData, isDirect: true })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="ml-2">Direct Message</span>
              </label>
            </div>
          </div>

          {!formData.isDirect && (
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Privacy</label>
              <div className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="isPrivate"
                  checked={formData.isPrivate}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="ml-2">Private Room</span>
              </div>
            </div>
          )}
        </div>

        {!formData.isDirect && (
          <>
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium">
                Room Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter room name"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium"
              >
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter room description"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">
            Add Users (Optional)
          </label>
          <div className="flex">
            <input
              type="number"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              className="w-full rounded-l-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter user ID"
            />
            <button
              type="button"
              onClick={handleAddUserId}
              className="rounded-r-md bg-primary px-4 py-2 text-white hover:bg-primary-dark"
            >
              Add
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {formData.isDirect
              ? "For direct messages, add at least one user ID"
              : "You can create a room without adding other users initially"}
          </p>
        </div>

        {formData.userIds.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium">
              Selected Users
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.userIds.map((userId) => (
                <div
                  key={userId}
                  className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-sm"
                >
                  User #{userId}
                  <button
                    type="button"
                    onClick={() => handleRemoveUserId(userId)}
                    className="ml-2 text-gray-600 hover:text-red-600"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate("/chat")}
            className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              isLoading || (formData.isDirect && formData.userIds.length === 0)
            }
            className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Create Room"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateRoomPage;
