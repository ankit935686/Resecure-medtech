import React, { useState } from 'react';

const UnifiedTimeline = ({ items = [], workspaceId, compact = false, showFilters = false }) => {
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesSearch = !searchTerm || 
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCritical = !showCriticalOnly || item.is_critical;
    return matchesType && matchesSearch && matchesCritical;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getIconColor = (type) => {
    const colors = {
      'intake': 'bg-indigo-500',
      'report': 'bg-gray-500',
      'visit': 'bg-green-500',
      'lab_result': 'bg-teal-500',
      'condition': 'bg-blue-500',
      'medication': 'bg-orange-500',
      'allergy': 'bg-pink-500',
      'surgery': 'bg-cyan-500'
    };
    return colors[type] || 'bg-gray-400';
  };

  const renderTimelineItem = (item, index) => {
    const isCompact = compact;
    const markerColor = getIconColor(item.type);
    
    return (
      <div 
        key={item.id || index} 
        className={`relative mb-6 pb-6 ${item.is_critical ? 'border-l-4 border-red-500 pl-8' : 'border-l-2 border-gray-300 pl-8'} ${isCompact ? 'mb-3 pb-3' : ''}`}
      >
        {/* Timeline marker */}
        <div className={`absolute left-0 top-0 -ml-3 flex h-10 w-10 items-center justify-center rounded-full ${markerColor} text-white shadow-md`}>
          <span className="text-lg">{item.icon || '📄'}</span>
        </div>
        
        {/* Timeline content */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-lg font-semibold text-gray-800">{item.title}</h4>
                {item.is_critical && (
                  <span className="px-2 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                    Critical
                  </span>
                )}
                {item.is_abnormal && (
                  <span className="px-2 py-1 text-xs font-bold bg-yellow-100 text-yellow-700 rounded-full">
                    Abnormal
                  </span>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-500 whitespace-nowrap ml-2">{formatDate(item.date)}</span>
          </div>
          
          {!isCompact && (
            <>
              <p className="text-gray-700 text-sm mb-3">{item.summary}</p>
              
              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-gray-700">Source:</span> 
                  <span className="px-2 py-0.5 bg-gray-100 rounded">{item.source}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-gray-700">Type:</span> 
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded capitalize">{item.type?.replace('_', ' ')}</span>
                </span>
                {item.metadata?.verified !== undefined && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
                    item.metadata.verified 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.metadata.verified ? '✓ Verified' : '⚠ Unverified'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {showFilters && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Type Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Type</label>
              <select 
                value={typeFilter} 
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="all">All Types</option>
                <option value="intake">Intake Forms</option>
                <option value="report">Reports</option>
                <option value="lab_result">Lab Results</option>
                <option value="condition">Conditions</option>
                <option value="medication">Medications</option>
                <option value="allergy">Allergies</option>
                <option value="visit">Visits</option>
              </select>
            </div>
            
            {/* Critical Only Checkbox */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={showCriticalOnly}
                  onChange={(e) => setShowCriticalOnly(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-gray-700 font-medium">Critical Only</span>
              </label>
            </div>
            
            {/* Search Input */}
            <div className="flex-1 min-w-[250px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input 
                type="text"
                placeholder="Search timeline..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        {filteredItems.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-600">No timeline items found.</p>
            {(typeFilter !== 'all' || searchTerm || showCriticalOnly) && (
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          <div>
            {filteredItems.map((item, index) => renderTimelineItem(item, index))}
          </div>
        )}
      </div>
      
      {!compact && filteredItems.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold">{filteredItems.length}</span> of <span className="font-semibold">{items?.length || 0}</span> items
          </p>
        </div>
      )}
    </div>
  );
};

export default UnifiedTimeline;
