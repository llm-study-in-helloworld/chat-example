import React from 'react';
import ChangePasswordForm from '../components/Auth/ChangePasswordForm';

const SecuritySettingsPage: React.FC = () => {
  return (
    <div className="container mx-auto max-w-2xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="text-gray-600">Manage your account security</p>
      </div>
      
      <div className="space-y-6">
        <ChangePasswordForm />
        
        {/* Additional security settings could be added here */}
      </div>
    </div>
  );
};

export default SecuritySettingsPage; 