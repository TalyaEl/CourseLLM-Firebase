'use client';

import { useEffect, useState } from 'react';
import type { MessageAnalysis } from '../../../functions/src/types/messageAnalysis';
import type { AnalyzeMessageRequest } from '../../../functions/src/types/analyzeMessage';
import { getIstAnalysisEngine } from '@/lib/ist/engine';
import { getIstAnalysisRepository } from '@/lib/ist/repository';

export default function DebugAnalysisPage() {
  const [analysis, setAnalysis] = useState<MessageAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threadAnalyses, setThreadAnalyses] = useState<
    MessageAnalysis[] | null
  >(null);

  useEffect(() => {
    const run = async () => {
      try {
        const engine = getIstAnalysisEngine();

        const requestBody: AnalyzeMessageRequest = {
          threadId: 'debug-thread-2',
          messageId: 'debug-message-2',
          courseId: 'debug-course-2',
          language: 'en',
          maxHistoryMessages: 5,
          messageText: "Can you explain Bayes' theorem to me like I'm five?",
        };

        const result = await engine.analyzeMessage(requestBody);

        console.log('🔥 DebugAnalysisPage result from IstAnalysisEngine:', result);
        setAnalysis(result);

        const repo = getIstAnalysisRepository();
        await repo.save(result);
        const allForThread = await repo.listByThread(requestBody.threadId);

        setThreadAnalyses(allForThread);
        setError(null);
      } catch (err: any) {
        console.error('🔥 Error in DebugAnalysisPage:', err);
        setAnalysis(null);
        setError(err.message ?? String(err));
      }
    };

    run();
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Debug Analysis</h1>
      <p>
        This page calls the shared <code>IstAnalysisEngine</code>{' '}
        (currently backed by <code>/api/analyze-message</code>) and shows the returned{' '}
        <code>MessageAnalysis</code> JSON.
      </p>

      {error && (
        <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>
      )}

      {!error && !analysis && <p>Loading analysis...</p>}

      {analysis && (
        <pre
          style={{
            marginTop: '1rem',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '0.85rem',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          {JSON.stringify(analysis, null, 2)}
        </pre>
      )}

      {threadAnalyses && (
        <section style={{ marginTop: '2rem' }}>
          <h2>All analyses for thread: {analysis?.metadata.threadId}</h2>
          <p>Count: {threadAnalyses.length}</p>
          <pre
            style={{
              marginTop: '0.5rem',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px dashed #ccc',
              fontSize: '0.8rem',
              maxWidth: '100%',
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(threadAnalyses, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
