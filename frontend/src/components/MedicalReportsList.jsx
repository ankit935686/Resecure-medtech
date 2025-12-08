import { useState, useEffect } from 'react';
import { FileText, Download, Eye, MessageSquare, Calendar, Filter, Search, Activity, Image, AlertTriangle, CheckCircle, Clock, Loader } from 'lucide-react';
import api from '../services/api';

const REPORT_TYPE_ICONS = {
  lab_report: Activity,
  x_ray: Image,
  mri_scan: Image,
  ct_scan: Image,
  ultrasound: Image,
  prescription: FileText,
  ecg: Activity,
  blood_test: Activity,
  pathology: FileText,
  discharge_summary: FileText,
  consultation_notes: FileText,
  other: FileText
};

const STATUS_CONFIG = {
  uploaded: { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50', label: 'Uploaded' },
  processing: { icon: Loader, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Processing' },
  ocr_complete: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50', label: 'OCR Complete' },
  ai_analyzing: { icon: Loader, color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'AI Analyzing' },
  ready_for_review: { icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50', label: 'Ready for Review' },
  reviewed: { icon: CheckCircle, color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'Reviewed' }
};

export default function MedicalReportsList({ workspaceId, onViewReport, onAddComment, userRole = 'patient' }) {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    reportType: 'all',
    status: 'all',
    criticalOnly: false
  });

  useEffect(() => {
    loadReports();
  }, [workspaceId]);

  useEffect(() => {
    applyFilters();
  }, [reports, filters]);

  const loadReports = async () => {
    setLoading(true);
    setError('');

    try {
      const data = userRole === 'doctor' 
        ? await api.doctor.getMedicalReports(workspaceId)
        : await api.patient.getMedicalReports(workspaceId);
      
      setReports(data.reports || []);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError('Failed to load medical reports');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(report =>
        report.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        report.description?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Report type filter
    if (filters.reportType !== 'all') {
      filtered = filtered.filter(report => report.report_type === filters.reportType);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(report => report.status === filters.status);
    }

    // Critical filter
    if (filters.criticalOnly) {
      filtered = filtered.filter(report => report.is_critical);
    }

    setFilteredReports(filtered);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading medical reports...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Reviewed</p>
              <p className="text-2xl font-bold text-purple-600">
                {reports.filter(r => r.reviewed_by_doctor || r.status === 'reviewed').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-blue-600">
                {reports.filter(r => r.status === 'processing' || r.status === 'ai_analyzing').length}
              </p>
            </div>
            <Loader className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-red-600">
                {reports.filter(r => r.is_critical).length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Report Type Filter */}
          <select
            value={filters.reportType}
            onChange={(e) => setFilters({ ...filters, reportType: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="lab_report">Lab Report</option>
            <option value="x_ray">X-Ray</option>
            <option value="mri_scan">MRI Scan</option>
            <option value="ct_scan">CT Scan</option>
            <option value="blood_test">Blood Test</option>
            <option value="prescription">Prescription</option>
            <option value="ecg">ECG/EKG</option>
            <option value="other">Other</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="uploaded">Uploaded</option>
            <option value="processing">Processing</option>
            <option value="ocr_complete">OCR Complete</option>
            <option value="ai_analyzing">AI Analyzing</option>
            <option value="ready_for_review">Ready for Review</option>
            <option value="reviewed">Reviewed</option>
          </select>

          {/* Critical Filter */}
          <label className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.criticalOnly}
              onChange={(e) => setFilters({ ...filters, criticalOnly: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">Critical Only</span>
          </label>
        </div>
      </div>

      {/* Reports List */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {filteredReports.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <FileText className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-900 text-xl font-semibold">No reports found</p>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            {reports.length === 0
              ? 'Upload your first medical report to get started with automatic OCR and AI analysis'
              : 'Try adjusting your filters to find what you\'re looking for'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Results header */}
          <div className="flex items-center justify-between px-2">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredReports.length}</span> of <span className="font-semibold">{reports.length}</span> reports
            </p>
          </div>

          {/* Reports Grid/List */}
          <div className="grid grid-cols-1 gap-4">
            {filteredReports.map((report) => {
              const ReportIcon = REPORT_TYPE_ICONS[report.report_type] || FileText;
              const statusConfig = STATUS_CONFIG[report.status] || STATUS_CONFIG.uploaded;
              const StatusIcon = statusConfig?.icon || Clock;

              return (
                <div
                  key={report.id}
                  className={`bg-white rounded-xl border-2 p-5 hover:shadow-lg transition-all cursor-pointer group ${
                    report.is_critical 
                      ? 'border-red-300 bg-gradient-to-r from-red-50/50 to-white' 
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => onViewReport(report)}
                >
                  <div className="flex items-start space-x-4">
                    {/* Icon with Type Badge */}
                    <div className="flex-shrink-0">
                      <div className={`p-4 rounded-xl shadow-sm ${
                        report.is_critical ? 'bg-red-100 border-2 border-red-200' : 'bg-blue-50 border-2 border-blue-100'
                      }`}>
                        <ReportIcon className={`w-7 h-7 ${report.is_critical ? 'text-red-600' : 'text-blue-600'}`} />
                      </div>
                      <p className="text-xs text-center text-gray-500 mt-2 font-medium">
                        {report.report_type_display?.split(' ')[0]}
                      </p>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title and Badges */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 mr-4">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                              {report.title || 'Untitled Report'}
                            </h3>
                            {report.is_critical && (
                              <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center shadow-sm">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                CRITICAL
                              </span>
                            )}
                            {report.reviewed_by_doctor && (
                              <span className="px-2.5 py-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Reviewed
                              </span>
                            )}
                          </div>
                          {report.description && (
                            <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{report.description}</p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewReport(report);
                            }}
                            className="p-2.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddComment(report);
                            }}
                            className="p-2.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors relative"
                            title="Comments"
                          >
                            <MessageSquare className="w-5 h-5" />
                            {report.comment_count > 0 && (
                              <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                {report.comment_count}
                              </span>
                            )}
                          </button>
                          {report.file_url && (
                            <a
                              href={report.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Download"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          )}
                        </div>
                      </div>
                      
                      {/* Metadata Row */}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3 text-sm">
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-4 h-4 mr-1.5" />
                          <span className="font-medium">Report Date:</span>
                          <span className="ml-1">{formatDate(report.report_date)}</span>
                        </div>
                        <div className={`flex items-center px-2.5 py-1 rounded-full ${statusConfig?.bgColor || 'bg-gray-100'}`}>
                          <StatusIcon className={`w-4 h-4 mr-1.5 ${statusConfig?.color || 'text-gray-600'} ${report.status === 'processing' ? 'animate-spin' : ''}`} />
                          <span className={`font-semibold ${statusConfig?.color || 'text-gray-600'}`}>
                            {statusConfig?.label || report.status}
                          </span>
                        </div>
                        {report.ocr_processed && (
                          <span className="flex items-center text-green-600 font-medium px-2.5 py-1 bg-green-50 rounded-full">
                            <CheckCircle className="w-4 h-4 mr-1.5" />
                            OCR Done
                          </span>
                        )}
                        {report.ai_processed && (
                          <span className="flex items-center text-purple-600 font-medium px-2.5 py-1 bg-purple-50 rounded-full">
                            <Activity className="w-4 h-4 mr-1.5" />
                            AI Analyzed
                          </span>
                        )}
                      </div>

                      {/* File Info */}
                      {report.file_name && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center text-xs text-gray-500">
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            <span className="truncate">{report.file_name}</span>
                            {report.file_size && (
                              <>
                                <span className="mx-2">•</span>
                                <span>{(report.file_size / 1024 / 1024).toFixed(2)} MB</span>
                              </>
                            )}
                            {report.file_extension && (
                              <>
                                <span className="mx-2">•</span>
                                <span className="uppercase">{report.file_extension.replace('.', '')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
