import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Send,
  Save,
  FileText,
  Type,
  Hash,
  Calendar,
  List,
  AlignLeft,
  Upload,
  CheckSquare,
  Eye,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import api from '../../services/api';

const fieldTypes = [
  { value: 'text', label: 'Short Text', icon: Type },
  { value: 'textarea', label: 'Long Text', icon: AlignLeft },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'select', label: 'Dropdown', icon: List },
  { value: 'multiselect', label: 'Multi-Select', icon: CheckSquare },
];

const categories = [
  { value: 'personal', label: 'Personal Info' },
  { value: 'medical', label: 'Medical' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'history', label: 'Medical History' },
];

const uploadTypes = [
  { value: 'medical_report', label: 'Medical Report' },
  { value: 'lab_result', label: 'Lab Result' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'imaging', label: 'Imaging/Scan' },
  { value: 'document', label: 'Document' },
];

export default function IntakeFormBuilder() {
  const navigate = useNavigate();
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');
  const patientName = searchParams.get('patient');

  const [step, setStep] = useState(formId ? 'builder' : 'prompt'); // 'prompt' | 'generating' | 'builder' | 'preview'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    id: null,
    title: 'Patient Intake Form',
    description: '',
    doctor_prompt: '',
    form_schema: { fields: [], report_uploads: [] },
    status: 'draft',
  });

  // Load existing form if formId is provided
  useEffect(() => {
    if (formId) {
      loadForm();
    }
  }, [formId]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const data = await api.doctor.getIntakeFormDetail(formId);
      setFormData({
        id: data.id,
        title: data.title,
        description: data.description,
        doctor_prompt: data.doctor_prompt,
        form_schema: data.form_schema || { fields: [], report_uploads: [] },
        status: data.status,
      });
      setStep('builder');
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Failed to load form');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateForm = async () => {
    if (!formData.doctor_prompt.trim()) {
      alert('Please describe what information you need from the patient');
      return;
    }

    try {
      setStep('generating');
      const response = await api.doctor.createIntakeForm(
        workspaceId,
        formData.doctor_prompt,
        formData.title,
        formData.description
      );

      setFormData({
        id: response.id,
        title: response.title,
        description: response.description,
        doctor_prompt: response.doctor_prompt,
        form_schema: response.form_schema || { fields: [], report_uploads: [] },
        status: response.status,
      });
      setStep('builder');
    } catch (error) {
      console.error('Error generating form:', error);
      alert(error.response?.data?.error || 'Failed to generate form. Please try again.');
      setStep('prompt');
    }
  };

  const handleSaveForm = async () => {
    try {
      setSaving(true);
      await api.doctor.updateIntakeForm(formData.id, {
        title: formData.title,
        description: formData.description,
        form_schema: formData.form_schema,
      });
      alert('Form saved successfully!');
    } catch (error) {
      console.error('Error saving form:', error);
      alert('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const handleSendForm = async () => {
    if (!formData.form_schema.fields?.length && !formData.form_schema.report_uploads?.length) {
      alert('Please add at least one field or report request before sending');
      return;
    }

    if (!confirm('Send this form to the patient? They will receive a notification.')) {
      return;
    }

    try {
      setSaving(true);
      // Save first
      await api.doctor.updateIntakeForm(formData.id, {
        title: formData.title,
        description: formData.description,
        form_schema: formData.form_schema,
      });
      // Then send
      await api.doctor.sendIntakeForm(formData.id);
      alert('Form sent to patient successfully!');
      navigate(-1);
    } catch (error) {
      console.error('Error sending form:', error);
      alert(error.response?.data?.error || 'Failed to send form');
    } finally {
      setSaving(false);
    }
  };

  // Field management
  const addField = () => {
    const newField = {
      id: `field_${Date.now()}`,
      label: 'New Question',
      type: 'text',
      required: false,
      placeholder: '',
      helpText: '',
      options: [],
      category: 'medical',
    };
    setFormData((prev) => ({
      ...prev,
      form_schema: {
        ...prev.form_schema,
        fields: [...(prev.form_schema.fields || []), newField],
      },
    }));
  };

  const updateField = (index, updates) => {
    setFormData((prev) => ({
      ...prev,
      form_schema: {
        ...prev.form_schema,
        fields: prev.form_schema.fields.map((f, i) => (i === index ? { ...f, ...updates } : f)),
      },
    }));
  };

  const removeField = (index) => {
    setFormData((prev) => ({
      ...prev,
      form_schema: {
        ...prev.form_schema,
        fields: prev.form_schema.fields.filter((_, i) => i !== index),
      },
    }));
  };

  const moveField = (index, direction) => {
    const newFields = [...formData.form_schema.fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newFields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFormData((prev) => ({
      ...prev,
      form_schema: { ...prev.form_schema, fields: newFields },
    }));
  };

  // Upload management
  const addUploadRequest = () => {
    const newUpload = {
      id: `upload_${Date.now()}`,
      label: 'New Document Request',
      description: '',
      required: false,
      upload_type: 'medical_report',
    };
    setFormData((prev) => ({
      ...prev,
      form_schema: {
        ...prev.form_schema,
        report_uploads: [...(prev.form_schema.report_uploads || []), newUpload],
      },
    }));
  };

  const updateUpload = (index, updates) => {
    setFormData((prev) => ({
      ...prev,
      form_schema: {
        ...prev.form_schema,
        report_uploads: prev.form_schema.report_uploads.map((u, i) =>
          i === index ? { ...u, ...updates } : u
        ),
      },
    }));
  };

  const removeUpload = (index) => {
    setFormData((prev) => ({
      ...prev,
      form_schema: {
        ...prev.form_schema,
        report_uploads: prev.form_schema.report_uploads.filter((_, i) => i !== index),
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {formId ? 'Edit Intake Form' : 'Create AI Intake Form'}
                </h1>
                {patientName && (
                  <p className="text-sm text-gray-500">For: {decodeURIComponent(patientName)}</p>
                )}
              </div>
            </div>

            {step === 'builder' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('preview')}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={handleSaveForm}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>
                <button
                  onClick={handleSendForm}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to Patient
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step 1: AI Prompt */}
        {step === 'prompt' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">AI Form Generator</h2>
                    <p className="text-blue-100">Describe what information you need</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Form Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="e.g., Post-Surgery Recovery Assessment"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Brief description for the patient"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What do you want to know from the patient? *
                  </label>
                  <textarea
                    value={formData.doctor_prompt}
                    onChange={(e) => setFormData((prev) => ({ ...prev, doctor_prompt: e.target.value }))}
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    placeholder="Example: I need to assess post-surgery recovery. Ask about current pain levels, mobility status, medication compliance, any complications or concerns. Also request recent X-ray and physical therapy progress reports."
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Be specific about the information you need. The AI will generate appropriate form fields.
                  </p>
                </div>

                <button
                  onClick={handleGenerateForm}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Generate Form with AI
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Generating */}
        {step === 'generating' && (
          <div className="max-w-md mx-auto text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating Your Form</h2>
            <p className="text-gray-500">AI is creating a personalized intake form based on your requirements...</p>
            <div className="mt-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          </div>
        )}

        {/* Step 3: Form Builder */}
        {step === 'builder' && (
          <div className="space-y-6">
            {/* Form Header */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Form Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Form Questions ({formData.form_schema.fields?.length || 0})
                </h3>
                <button
                  onClick={addField}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Field
                </button>
              </div>

              <div className="divide-y divide-gray-100">
                {formData.form_schema.fields?.map((field, index) => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    index={index}
                    totalFields={formData.form_schema.fields.length}
                    onChange={(updates) => updateField(index, updates)}
                    onRemove={() => removeField(index)}
                    onMove={(direction) => moveField(index, direction)}
                  />
                ))}
                {(!formData.form_schema.fields || formData.form_schema.fields.length === 0) && (
                  <div className="p-8 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No questions added yet. Click "Add Field" to create one.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Document Uploads */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  Document Requests ({formData.form_schema.report_uploads?.length || 0})
                </h3>
                <button
                  onClick={addUploadRequest}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Request
                </button>
              </div>

              <div className="divide-y divide-gray-100">
                {formData.form_schema.report_uploads?.map((upload, index) => (
                  <UploadEditor
                    key={upload.id}
                    upload={upload}
                    index={index}
                    onChange={(updates) => updateUpload(index, updates)}
                    onRemove={() => removeUpload(index)}
                  />
                ))}
                {(!formData.form_schema.report_uploads ||
                  formData.form_schema.report_uploads.length === 0) && (
                  <div className="p-8 text-center text-gray-500">
                    <Upload className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No document requests. Click "Add Request" to ask for uploads.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 'preview' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setStep('builder')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Editor
              </button>
              <span className="text-sm text-gray-500">Preview Mode</span>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
                <h2 className="text-2xl font-bold">{formData.title}</h2>
                {formData.description && <p className="mt-1 text-blue-100">{formData.description}</p>}
              </div>

              <div className="p-8 space-y-6">
                {formData.form_schema.fields?.map((field, index) => (
                  <PreviewField key={field.id} field={field} index={index} />
                ))}

                {formData.form_schema.report_uploads?.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Upload className="w-5 h-5 text-emerald-600" />
                      Required Documents
                    </h3>
                    {formData.form_schema.report_uploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="p-4 bg-gray-50 rounded-xl mb-3 last:mb-0"
                      >
                        <p className="font-medium text-gray-900">
                          {upload.label}
                          {upload.required && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        {upload.description && (
                          <p className="text-sm text-gray-500 mt-1">{upload.description}</p>
                        )}
                        <button className="mt-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm hover:border-gray-400">
                          Click to upload
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold">
                  Submit Form (Preview)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Field Editor Component
function FieldEditor({ field, index, totalFields, onChange, onRemove, onMove }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-2">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === totalFields - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 font-medium">Q{index + 1}</span>
            <input
              type="text"
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
              placeholder="Question"
            />
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={onRemove}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {expanded && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pl-8">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={field.type}
                  onChange={(e) => onChange({ type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                >
                  {fieldTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select
                  value={field.category || 'medical'}
                  onChange={(e) => onChange({ category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Required</label>
                <button
                  onClick={() => onChange({ required: !field.required })}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    field.required
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {field.required ? 'Required' : 'Optional'}
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Placeholder</label>
                <input
                  type="text"
                  value={field.placeholder || ''}
                  onChange={(e) => onChange({ placeholder: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Hint text..."
                />
              </div>

              {(field.type === 'select' || field.type === 'multiselect') && (
                <div className="col-span-full">
                  <label className="block text-xs text-gray-500 mb-1">
                    Options (comma separated)
                  </label>
                  <input
                    type="text"
                    value={(field.options || []).join(', ')}
                    onChange={(e) =>
                      onChange({
                        options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    placeholder="Option 1, Option 2, Option 3"
                  />
                </div>
              )}

              <div className="col-span-full">
                <label className="block text-xs text-gray-500 mb-1">Help Text</label>
                <input
                  type="text"
                  value={field.helpText || ''}
                  onChange={(e) => onChange({ helpText: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Additional instructions..."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Upload Editor Component
function UploadEditor({ upload, index, onChange, onRemove }) {
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Upload className="w-5 h-5 text-emerald-600" />
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={upload.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium"
            placeholder="Document name"
          />
          <select
            value={upload.upload_type || 'medical_report'}
            onChange={(e) => onChange({ upload_type: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
          >
            {uploadTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChange({ required: !upload.required })}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                upload.required
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {upload.required ? 'Required' : 'Optional'}
            </button>
            <button
              onClick={onRemove}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-2 pl-13">
        <input
          type="text"
          value={upload.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm ml-13"
          placeholder="Description for the patient..."
          style={{ marginLeft: '52px' }}
        />
      </div>
    </div>
  );
}

// Preview Field Component
function PreviewField({ field, index }) {
  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            className="w-full px-4 py-3 rounded-xl border border-gray-200 resize-none"
            rows={3}
            placeholder={field.placeholder}
            disabled
          />
        );
      case 'number':
        return (
          <input
            type="number"
            className="w-full px-4 py-3 rounded-xl border border-gray-200"
            placeholder={field.placeholder}
            disabled
          />
        );
      case 'date':
        return (
          <input
            type="date"
            className="w-full px-4 py-3 rounded-xl border border-gray-200"
            disabled
          />
        );
      case 'select':
        return (
          <select className="w-full px-4 py-3 rounded-xl border border-gray-200" disabled>
            <option value="">Select an option</option>
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
              <label key={i} className="flex items-center gap-2">
                <input type="checkbox" className="rounded" disabled />
                <span className="text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );
      default:
        return (
          <input
            type="text"
            className="w-full px-4 py-3 rounded-xl border border-gray-200"
            placeholder={field.placeholder}
            disabled
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
      {field.helpText && <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>}
    </div>
  );
}
