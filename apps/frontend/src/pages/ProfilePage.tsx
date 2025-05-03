import { UpdateUserRequest, User } from '@chat-example/types';
import { useState } from 'react';

const ProfilePage = () => {
  // Mock user data
  const [user, setUser] = useState<User>({
    id: 1,
    username: 'JohnDoe',
    email: 'john.doe@example.com',
    nickname: 'JohnDoe',
    imageUrl: null,
    bio: 'Chat application enthusiast',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UpdateUserRequest>({
    nickname: user.nickname,
    email: user.email,
    bio: user.bio
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update user data
      setUser(prev => ({
        ...prev,
        nickname: formData.nickname || prev.nickname,
        email: formData.email || prev.email,
        bio: formData.bio || prev.bio,
        updatedAt: new Date().toISOString()
      }));
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      nickname: user.nickname,
      email: user.email,
      bio: user.bio
    });
    setIsEditing(false);
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-gray-600">Manage your account information</p>
      </div>
      
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-center text-2xl text-white">
              {user.imageUrl ? (
                <img 
                  src={user.imageUrl} 
                  alt={user.nickname} 
                  className="h-full w-full rounded-full object-cover" 
                />
              ) : (
                <span>{user.nickname.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{user.nickname}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
            >
              Edit Profile
            </button>
          )}
        </div>
        
        <div className="p-6">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                  Nickname
                </label>
                <input
                  id="nickname"
                  name="nickname"
                  type="text"
                  required
                  value={formData.nickname}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                />
              </div>
              
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  value={formData.bio}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Nickname</h3>
                <p className="mt-1">{user.nickname}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="mt-1">{user.email}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Bio</h3>
                <p className="mt-1">{user.bio || 'No bio provided'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage; 