import { MessageResponse } from "@chat-example/types";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { chatService } from "../api/chatService";
import { useSocket } from "../hooks/useSocket";
import { useAuthStore } from "../store/authStore";

const BATCH_SIZE = 50; // Number of messages to load per batch

const ChatRoomPage = () => {
  const { roomId } = useParams();
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const oldestMessageIdRef = useRef<number | null>(null);
  const { user } = useAuthStore();
  const { socket, joinRoom, sendMessage } = useSocket();

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Join room via socket when component mounts
  useEffect(() => {
    if (roomId && socket) {
      const roomIdNumber = parseInt(roomId);
      setSocketError(null); // Reset any previous errors

      joinRoom(roomIdNumber)
        .then(() => {
          console.log(`Joined room ${roomIdNumber} via socket`);
          setSocketError(null);
        })
        .catch((error) => {
          console.error(`Failed to join room: ${error.message}`);
          setSocketError(`Socket error: ${error.message}`);
          // Still load messages even if socket connection fails
          fetchInitialMessages();
        });
    }
  }, [roomId, socket, joinRoom]);

  // Listen for new messages via socket
  useEffect(() => {
    const handleNewMessage = (message: MessageResponse) => {
      if (message.roomId === parseInt(roomId || "0")) {
        console.log("New message received via socket:", message);
        setMessages((prev) => {
          // Check if message already exists (to avoid duplicates)
          const exists = prev.some((m) => m.id === message.id);
          if (exists) {
            return prev;
          }
          return [...prev, message];
        });

        // Scroll to bottom when receiving new messages if already near bottom
        const container = messagesContainerRef.current;
        if (container) {
          const isNearBottom =
            container.scrollHeight -
              container.scrollTop -
              container.clientHeight <
            200;
          if (isNearBottom) {
            setTimeout(scrollToBottom, 100);
          }
        }
      }
    };

    if (socket) {
      socket.on("new_message", handleNewMessage);
    }

    return () => {
      if (socket) {
        socket.off("new_message", handleNewMessage);
      }
    };
  }, [roomId, socket]);

  // Setup infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const container = messagesContainerRef.current;
      if (!container || loadingMore || !hasMoreMessages) return;

      // Load more when user scrolls to top (with a small buffer)
      if (container.scrollTop < 100) {
        loadMoreMessages();
      }
    };

    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, [loadingMore, hasMoreMessages]);

  // Fetch initial messages from API (most recent batch)
  const fetchInitialMessages = async () => {
    if (!roomId) return;

    setLoading(true);
    try {
      const roomIdNumber = parseInt(roomId);
      const response = await chatService.getMessages(
        roomIdNumber,
        BATCH_SIZE,
        0,
      );
      console.log("Initial messages:", response);

      // Sort messages by timestamp to ensure chronological order
      const sortedMessages = [...response].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      setMessages(sortedMessages || []);

      // If we received fewer messages than the batch size, there are no more to load
      setHasMoreMessages(response.length >= BATCH_SIZE);

      // Store the oldest message ID for pagination
      if (sortedMessages.length > 0) {
        oldestMessageIdRef.current = sortedMessages[0].id;
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
      // Ensure we scroll to the bottom after loading initial messages
      setTimeout(scrollToBottom, 100);
    }
  };

  // Load more (older) messages when scrolling up
  const loadMoreMessages = async () => {
    if (!roomId || !hasMoreMessages || loadingMore) return;

    setLoadingMore(true);
    try {
      const roomIdNumber = parseInt(roomId);

      // Get the current scroll position to restore later
      const container = messagesContainerRef.current;
      const scrollHeight = container?.scrollHeight || 0;

      // Load messages older than the oldest one we have
      const olderMessages = await chatService.getMessages(
        roomIdNumber,
        BATCH_SIZE,
        messages.length, // Use as offset
      );

      if (olderMessages.length > 0) {
        // Sort older messages by timestamp
        const sortedOlderMessages = [...olderMessages].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        // Add older messages to the beginning of our list
        setMessages((prev) => [...sortedOlderMessages, ...prev]);

        // Update oldest message reference
        oldestMessageIdRef.current = sortedOlderMessages[0].id;

        // If we got fewer messages than requested, we've reached the end
        setHasMoreMessages(olderMessages.length >= BATCH_SIZE);

        // Restore scroll position to prevent jumping
        if (container) {
          setTimeout(() => {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - scrollHeight;
          }, 0);
        }
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Fetch messages from API on initial load
  useEffect(() => {
    // Reset state when changing rooms
    setMessages([]);
    setHasMoreMessages(true);
    oldestMessageIdRef.current = null;
    fetchInitialMessages();
  }, [roomId]);

  // Scroll to bottom when sending new messages
  useEffect(() => {
    // Only auto-scroll if we're already near the bottom
    const shouldScroll =
      messagesContainerRef.current &&
      messagesContainerRef.current.scrollHeight -
        messagesContainerRef.current.scrollTop -
        messagesContainerRef.current.clientHeight <
        200;

    if (shouldScroll || loading) {
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !roomId || !user) return;

    const content = newMessage.trim();
    const roomIdNumber = parseInt(roomId);

    setNewMessage(""); // Clear input immediately for better UX

    try {
      let createdMessage: MessageResponse;

      // Try socket first, but fallback to REST API
      if (socket && socket.connected) {
        try {
          console.log("Attempting to send message via socket");
          createdMessage = await sendMessage(roomIdNumber, content);
          console.log("Message sent via socket:", createdMessage);
          setSocketError(null); // Clear any previous errors on success
        } catch (socketError) {
          console.error(
            "Socket message send failed, falling back to API:",
            socketError,
          );
          setSocketError(
            `Socket error: ${
              socketError instanceof Error
                ? socketError.message
                : "Unknown error"
            }`,
          );
          createdMessage = await chatService.createMessage(
            roomIdNumber,
            content,
          );
          console.log("Message created via API fallback:", createdMessage);

          // Add message to local state since we're not using socket
          setMessages((prev) => [...prev, createdMessage]);
        }
      } else {
        // Socket not available, use REST API directly
        console.log("No socket connection, using API directly");
        createdMessage = await chatService.createMessage(roomIdNumber, content);
        console.log("Message created via API:", createdMessage);

        // Add message to local state since we're not using socket
        setMessages((prev) => [...prev, createdMessage]);
      }

      // Always scroll to bottom after sending a message
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  // Function to format timestamps
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const currentUserId = user?.id;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-semibold">
          {roomId ? `Chat Room #${roomId}` : "General Chat"}
        </h1>
        {socketError && (
          <div className="mt-1 text-sm text-red-500">
            {socketError} - Using REST API fallback
          </div>
        )}
        {socket && socket.connected && (
          <div className="mt-1 flex items-center text-sm text-green-500">
            <div className="mr-1 h-2 w-2 rounded-full bg-green-500"></div>
            Real-time connection active
          </div>
        )}
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
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
            {/* Loading indicator for older messages */}
            {loadingMore && (
              <div className="flex justify-center p-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              </div>
            )}

            {/* Load more button */}
            {hasMoreMessages && !loadingMore && (
              <div className="flex justify-center p-2">
                <button
                  onClick={loadMoreMessages}
                  className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                >
                  Load older messages
                </button>
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderId === currentUserId
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.senderId === currentUserId
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.senderId !== currentUserId && (
                    <div className="mb-1 text-xs font-semibold">
                      {message.sender.nickname}
                    </div>
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
        <form
          onSubmit={handleSendMessage}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
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
