import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Send,
  Upload,
  X,
  FileText,
  Check,
  AlertCircle,
  Image,
  File,
  Trash2,
  CheckCircle,
  Clock,
} from 'lucide-react';
import api from '../../services/api';

export default function IntakeFormFiller() {
  const navigate = useNavigate();
  const { formId } = useParams();
  const fileInputRefs = useRef({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState({});
  const [uploads, setUploads] = useState({});
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const data = await api.patient.getIntakeFormDetail(formId);
      setForm(data);

      // Initialize responses from existing submission if any
      if (data.response?.response_data) {
        setResponses(data.response.response_data);
      }

      // Initialize uploads from existing files in the uploads array
      if (data.uploads && data.uploads.length > 0) {
        const existingUploads = {};
        data.uploads.forEach((file) => {
          if (!existingUploads[file.field_id]) {
            existingUploads[file.field_id] = [];
          }
          existingUploads[file.field_id].push(file);
        });
        setUploads(existingUploads);
      }
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Failed to load form');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (fieldId, value) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => ({ ...prev, [fieldId]: null }));
    }
  };

  const handleMultiSelectChange = (fieldId, option, checked) => {
    setResponses((prev) => {
      const current = prev[fieldId] || [];
      if (checked) {
        return { ...prev, [fieldId]: [...current, option] };
      } else {
        return { ...prev, [fieldId]: current.filter((o) => o !== option) };
      }
    });
  };

  const handleFileUpload = async (uploadRequestId, file) => {
    const uploadRequest = form.form_schema.report_uploads?.find((u) => u.id === uploadRequestId);
    if (!uploadRequest) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only images (JPEG, PNG, GIF) and PDF files are allowed');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    try {
      setUploadingFiles((prev) => ({ ...prev, [uploadRequestId]: true }));

      const uploadedFile = await api.patient.uploadFormFile(
        formId,
        uploadRequestId,
        uploadRequest.label || 'Document',
        file,
        uploadRequest.upload_type || 'document',
        ''
      );

      setUploads((prev) => ({
        ...prev,
        [uploadRequestId]: [...(prev[uploadRequestId] || []), uploadedFile.upload],
      }));
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [uploadRequestId]: false }));
    }
  };

  const handleDeleteFile = async (uploadRequestId, fileId) => {
    if (!confirm('Delete this file?')) return;

    try {
      await api.patient.deleteFormUpload(formId, fileId);
      setUploads((prev) => ({
        ...prev,
        [uploadRequestId]: prev[uploadRequestId].filter((f) => f.id !== fileId),
      }));
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Validate required fields
    form.form_schema.fields?.forEach((field) => {
      if (field.required) {
        const value = responses[field.id];
        if (!value || (Array.isArray(value) && value.length === 0)) {
          newErrors[field.id] = 'This field is required';
          isValid = false;
        }
      }
    });

    // Validate required uploads
    form.form_schema.report_uploads?.forEach((upload) => {
      if (upload.required) {
        const files = uploads[upload.id] || [];
        if (files.length === 0) {
          newErrors[upload.id] = 'This document is required';
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      alert('Please fill in all required fields');
      return;
    }

    if (!confirm('Submit this form? You can still edit your responses until the doctor reviews them.')) {
      return;
    }

    try {
      setSubmitting(true);
      await api.patient.saveFormResponse(formId, responses, true);
      alert('Form submitted successfully!');
      navigate(-1);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert(error.response?.data?.error || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    if (!form) return null;

    const statusConfig = {
      sent: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: FileText },
      submitted: { label: 'Submitted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      reviewed: { label: 'Reviewed', color: 'bg-purple-100 text-purple-700', icon: Check },
    };

    const config = statusConfig[form.status] || statusConfig.sent;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600">Form not found</p>
        </div>
      </div>
    );
  }

  const isSubmitted = form.status === 'submitted' || form.status === 'reviewed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{form.title}</h1>
                <p className="text-sm text-gray-500">
                  From: Dr. {form.doctor_name}
                </p>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Form Header */}
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-8 py-6 text-white">
            <h2 className="text-2xl font-bold">{form.title}</h2>
            {form.description && (
              <p className="mt-2 text-teal-100">{form.description}</p>
            )}
          </div>

          {/* Form Fields */}
          <div className="p-8 space-y-8">
            {form.form_schema.fields?.map((field, index) => (
              <FormField
                key={field.id}
                field={field}
                value={responses[field.id]}
                onChange={(value) => handleInputChange(field.id, value)}
                onMultiSelectChange={(option, checked) =>
                  handleMultiSelectChange(field.id, option, checked)
                }
                error={errors[field.id]}
                disabled={isSubmitted}
              />
            ))}

            {/* Upload Requests */}
            {form.form_schema.report_uploads?.length > 0 && (
              <div className="pt-6 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-teal-600" />
                  Required Documents
                </h3>
                <div className="space-y-6">
                  {form.form_schema.report_uploads.map((upload) => (
                    <UploadField
                      key={upload.id}
                      upload={upload}
                      files={uploads[upload.id] || []}
                      uploading={uploadingFiles[upload.id]}
                      error={errors[upload.id]}
                      disabled={isSubmitted}
                      onUpload={(file) => handleFileUpload(upload.id, file)}
                      onDelete={(fileId) => handleDeleteFile(upload.id, fileId)}
                      fileInputRef={(el) => (fileInputRefs.current[upload.id] = el)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            {!isSubmitted && (
              <div className="pt-6">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {submitting ? 'Submitting...' : 'Submit Form'}
                </button>
              </div>
            )}

            {isSubmitted && (
              <div className="pt-6 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">Form Submitted</p>
                    <p className="text-sm text-green-600">
                      {form.status === 'reviewed'
                        ? 'Your doctor has reviewed this form.'
                        : 'Your doctor will review your responses soon. AI analysis has been generated automatically.'}
                    </p>
                  </div>
                </div>

                {/* Show AI/OCR processing info */}
                {(form.ai_analysis || form.ocr_processed) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">✓ Advanced Processing Complete:</p>
                    <ul className="text-sm text-blue-700 space-y-1">
                      {form.ai_analysis && (
                        <li>• AI analysis of your responses has been generated for your doctor</li>
                      )}
                      {form.ocr_processed && form.uploads && form.uploads.length > 0 && (
                        <li>• {form.uploads.filter(u => u.ocr_processed).length} documents processed with medical information extraction</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Form Field Component
function FormField({ field, value, onChange, onMultiSelectChange, error, disabled }) {
  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${
              error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-teal-500'
            } focus:ring-2 focus:border-transparent resize-none transition-all`}
            rows={4}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${
              error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-teal-500'
            } focus:ring-2 focus:border-transparent transition-all`}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${
              error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-teal-500'
            } focus:ring-2 focus:border-transparent transition-all`}
            disabled={disabled}
          />
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${
              error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-teal-500'
            } focus:ring-2 focus:border-transparent transition-all`}
            disabled={disabled}
          >
            <option value="">Select an option...</option>
            {(field.options || []).map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {(field.options || []).map((opt, i) => (
              <label
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(value || []).includes(opt)}
                  onChange={(e) => onMultiSelectChange(opt, e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  disabled={disabled}
                />
                <span className="text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${
              error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-teal-500'
            } focus:ring-2 focus:border-transparent transition-all`}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
      {field.helpText && (
        <p className="mt-2 text-sm text-gray-500">{field.helpText}</p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
}

// Upload Field Component
function UploadField({ upload, files, uploading, error, disabled, onUpload, onDelete, fileInputRef }) {
  const localFileInputRef = useRef(null);
  
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = '';
    }
  };

  const getFileIcon = (file) => {
    if (file.file_type?.startsWith('image/')) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  return (
    <div className={`p-4 rounded-xl border ${error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-gray-900">
            {upload.label}
            {upload.required && <span className="text-red-500 ml-1">*</span>}
          </p>
          {upload.description && (
            <p className="text-sm text-gray-500 mt-1">{upload.description}</p>
          )}
        </div>
        <span className="text-xs px-2 py-1 bg-white rounded-full text-gray-500 border border-gray-200">
          {upload.upload_type?.replace('_', ' ')}
        </span>
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-2 mb-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
            >
              {getFileIcon(file)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.original_filename || file.file_name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.file_size / 1024).toFixed(1)} KB
                  {file.ocr_processed && (
                    <span className="ml-2 text-green-600">• OCR Complete</span>
                  )}
                </p>
              </div>
              {!disabled && (
                <button
                  onClick={() => onDelete(file.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {!disabled && (
        <div>
          <input
            type="file"
            ref={(el) => {
              localFileInputRef.current = el;
              if (fileInputRef) fileInputRef(el);
            }}
            onChange={handleFileChange}
            accept="image/*,.pdf"
            className="hidden"
          />
          <button
            onClick={() => localFileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                {files.length > 0 ? 'Upload Another' : 'Upload File'}
              </>
            )}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Accepted: Images (JPEG, PNG) and PDF. Max 10MB.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
}
