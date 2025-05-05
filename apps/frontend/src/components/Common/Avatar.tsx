import React from "react";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline";
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = "md",
  status,
  className = "",
}) => {
  // Get initials from name
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  // Define size classes
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  // Define status indicator sizes
  const statusSize = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
    xl: "w-4 h-4",
  };

  // Get background color from name (for consistent colors)
  const getColorFromName = (name: string) => {
    const colors = [
      "bg-pink-500",
      "bg-purple-500",
      "bg-indigo-500",
      "bg-blue-500",
      "bg-teal-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-orange-500",
      "bg-red-500",
    ];

    const charCode = name.charCodeAt(0) || 0;
    const index = charCode % colors.length;
    return colors[index];
  };

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} ${getColorFromName(
            name,
          )} flex items-center justify-center rounded-full text-white`}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={`absolute right-0 bottom-0 block ${
            statusSize[size]
          } rounded-full ring-2 ring-white ${
            status === "online" ? "bg-green-500" : "bg-gray-300"
          }`}
        ></span>
      )}
    </div>
  );
};

export default Avatar;
