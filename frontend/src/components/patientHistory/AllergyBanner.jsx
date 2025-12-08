import React from 'react';

const AllergyBanner = ({ allergies }) => {
  if (!allergies || allergies.length === 0) return null;

  return (
    <div className="bg-red-100 border-l-4 border-red-500 rounded-lg p-4 mb-6 shadow-md flex items-start gap-4">
      <div className="text-3xl">⚠️</div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-red-800 mb-2">Critical Allergies</h3>
        <div className="flex flex-wrap gap-2">
          {allergies.map((allergy, idx) => (
            <span 
              key={idx} 
              className="px-3 py-1 bg-red-600 text-white font-semibold rounded-full text-sm shadow-sm"
            >
              {allergy}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AllergyBanner;
