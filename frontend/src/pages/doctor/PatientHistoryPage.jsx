import React from 'react';
import { useParams } from 'react-router-dom';
import PatientHistoryDashboard from '../../components/patientHistory/PatientHistoryDashboard';

const PatientHistoryPage = () => {
  const { workspaceId } = useParams();

  return (
    <PatientHistoryDashboard workspaceId={workspaceId} />
  );
};

export default PatientHistoryPage;
