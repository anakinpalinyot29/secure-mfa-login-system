import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-6 border-t border-gray-200 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            © 2025 <span className="font-semibold text-gray-900">Anakin Palinyot</span>. All rights reserved.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Secure MFA Login System - Professional Authentication Solution
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
