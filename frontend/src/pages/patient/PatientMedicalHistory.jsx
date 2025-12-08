import { useState } from 'react';
import { Plus } from 'lucide-react';
import PatientMedicalHistoryView from '../../components/PatientMedicalHistoryView';

export default function PatientMedicalHistory() {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PatientMedicalHistoryView />

        {/* Add Entry Modal - Placeholder */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
              <h2 className="text-xl font-bold mb-4">Add Manual Entry</h2>
              <p className="text-gray-600 mb-4">
                Add personal medical information that you want to track.
              </p>
              {/* Add your form here */}
              <button
                onClick={() => setShowAddModal(false)}
                className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
