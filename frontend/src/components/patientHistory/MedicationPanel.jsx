import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MedicationPanel = ({ workspaceId }) => {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedications();
  }, [workspaceId]);

  const loadMedications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/patientHistory/workspace/${workspaceId}/category/medication/detailed/?status=active`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setMedications(response.data.entries || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading medications:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading medications...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">💊 Current Medications</h2>
        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 font-semibold rounded-full text-sm">
          {medications.length} active
        </span>
      </div>

      <div className="space-y-4">
        {medications.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-600">No active medications recorded</p>
          </div>
        ) : (
          medications.map((med) => (
            <div key={med.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-800 flex-1">{med.title}</h3>
                {med.requires_monitoring && (
                  <span className="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                    ⚠️ Requires Monitoring
                  </span>
                )}
              </div>
              
              {med.description && (
                <p className="text-sm text-gray-600 mb-3">{med.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                {med.category_data?.dosage && (
                  <div>
                    <span className="text-gray-600 font-medium">Dosage:</span>
                    <span className="ml-2 text-gray-800">{med.category_data.dosage}</span>
                  </div>
                )}
                
                {med.category_data?.frequency && (
                  <div>
                    <span className="text-gray-600 font-medium">Frequency:</span>
                    <span className="ml-2 text-gray-800">{med.category_data.frequency}</span>
                  </div>
                )}
                
                {med.category_data?.purpose && (
                  <div className="col-span-2">
                    <span className="text-gray-600 font-medium">Purpose:</span>
                    <span className="ml-2 text-gray-800">{med.category_data.purpose}</span>
                  </div>
                )}
                
                {med.start_date && (
                  <div>
                    <span className="text-gray-600 font-medium">Started:</span>
                    <span className="ml-2 text-gray-800">
                      {new Date(med.start_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                <div>
                  <span className="text-gray-600 font-medium">Source:</span>
                  <span className="ml-2 text-gray-800">{med.source_display}</span>
                </div>
              </div>
              
              {med.doctor_notes && (
                <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
                  <strong className="text-gray-700">Notes:</strong>
                  <span className="ml-2 text-gray-600">{med.doctor_notes}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MedicationPanel;
