import { useState } from 'react';
import { Upload, X, FileText, Image, Activity, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import api from '../services/api';

const REPORT_TYPES = [
  { value: 'lab_report', label: 'Lab Report', icon: Activity },
  { value: 'x_ray', label: 'X-Ray', icon: Image },
  { value: 'mri_scan', label: 'MRI Scan', icon: Image },
  { value: 'ct_scan', label: 'CT Scan', icon: Image },
  { value: 'ultrasound', label: 'Ultrasound', icon: Image },
  { value: 'prescription', label: 'Prescription', icon: FileText },
  { value: 'ecg', label: 'ECG/EKG', icon: Activity },
  { value: 'blood_test', label: 'Blood Test', icon: Activity },
  { value: 'pathology', label: 'Pathology Report', icon: FileText },
  { value: 'discharge_summary', label: 'Discharge Summary', icon: FileText },
  { value: 'consultation_notes', label: 'Consultation Notes', icon: FileText },
  { value: 'other', label: 'Other', icon: FileText }
];

export default function MedicalReportUpload({ workspaceId, onSuccess, onClose }) {
  const [uploadData, setUploadData] = useState({
    file: null,
    report_type: 'lab_report',
    title: '',
    description: '',
    report_date: new Date().toISOString().split('T')[0]
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a PDF or image file (JPG, PNG)');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setUploadData({ ...uploadData, file });
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!uploadData.file) {
      setError('Please select a file to upload');
      return;
    }

    if (!uploadData.title.trim()) {
      setError('Please enter a title for the report');
      return;
    }

    setUploading(true);
    setError('');
    setUploadStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('file', uploadData.file);
      formData.append('report_type', uploadData.report_type);
      formData.append('title', uploadData.title);
      formData.append('description', uploadData.description);
      formData.append('report_date', uploadData.report_date);

      const data = await api.patient.uploadMedicalReport(workspaceId, formData);

      setUploadStatus('success');
      setTimeout(() => {
        onSuccess(data.report);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload report');
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  };

  const selectedReportType = REPORT_TYPES.find(t => t.value === uploadData.report_type);
  const ReportIcon = selectedReportType?.icon || FileText;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Upload Medical Report</h2>
            <p className="text-blue-100 text-sm mt-1">
              Upload your medical document for automatic OCR and AI analysis
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Upload Status */}
        {uploadStatus && (
          <div className="p-6 border-b">
            {uploadStatus === 'uploading' && (
              <div className="flex items-center space-x-3 text-blue-600">
                <Loader className="w-5 h-5 animate-spin" />
                <div>
                  <p className="font-medium">Processing your report...</p>
                  <p className="text-sm text-gray-600">Running OCR and AI analysis</p>
                </div>
              </div>
            )}
            {uploadStatus === 'success' && (
              <div className="flex items-center space-x-3 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Report uploaded successfully!</p>
                  <p className="text-sm text-gray-600">OCR and AI analysis completed</p>
                </div>
              </div>
            )}
            {uploadStatus === 'error' && (
              <div className="flex items-center space-x-3 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Upload failed</p>
                  <p className="text-sm text-gray-600">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Medical Document *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-12 h-12 text-gray-400 mb-3" />
                {uploadData.file ? (
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{uploadData.file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(uploadData.file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-700">Click to upload</p>
                    <p className="text-sm text-gray-500">PDF, JPG, or PNG (max 10MB)</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {REPORT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setUploadData({ ...uploadData, report_type: type.value })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      uploadData.report_type === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    disabled={uploading}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-xs font-medium">{type.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Title *
            </label>
            <input
              type="text"
              value={uploadData.title}
              onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
              placeholder="E.g., Blood Test Results - December 2024"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
              required
            />
          </div>

          {/* Report Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Date *
            </label>
            <input
              type="date"
              value={uploadData.report_date}
              onChange={(e) => setUploadData({ ...uploadData, report_date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={uploadData.description}
              onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
              placeholder="Add any additional notes about this report..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={uploading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !uploadData.file}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg hover:from-blue-700 hover:to-indigo-800 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {uploading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Upload & Process</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
