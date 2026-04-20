import axios from 'axios';
import { getApiUrl } from '@/lib/utils';

const API = getApiUrl('/api');

export async function uploadAndProcessDocuments(patientId, files, callbacks = {}) {
  const selectedFiles = Array.from(files || []);
  if (selectedFiles.length === 0) {
    return { documents: [], results: [] };
  }

  const formData = new FormData();
  selectedFiles.forEach((file) => formData.append('files', file));

  const uploadRes = await axios.post(`${API}/upload/${patientId}`, formData, {
    withCredentials: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const documents = uploadRes.data?.documents || [];
  callbacks.onUploaded?.(documents);

  const results = [];
  for (const doc of documents) {
    if (doc.status === 'error') continue;

    try {
      const processRes = await axios.post(`${API}/process/${doc.document_id}`, {}, { withCredentials: true });
      const result = { doc_id: doc.document_id, status: 'success', data: processRes.data };
      results.push(result);
      callbacks.onProcessed?.(result);
    } catch (err) {
      const result = {
        doc_id: doc.document_id,
        status: 'error',
        error: err.response?.data?.detail || 'Processing failed',
      };
      results.push(result);
      callbacks.onProcessed?.(result);
    }
  }

  return { documents, results };
}
