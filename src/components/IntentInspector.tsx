'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { MessageAnalysis } from '../../functions/src/types/messageAnalysis';

type IntentInspectorProps = {
  threadId: string;
  messageId: string;
};

export default function IntentInspector({
  threadId,
  messageId,
}: IntentInspectorProps) {
  const [analysis, setAnalysis] = useState<MessageAnalysis | null>(null);

  useEffect(() => {
    const ref = doc(db, 'threads', threadId, 'analysis', messageId);

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        setAnalysis(snapshot.data() as MessageAnalysis);
      } else {
        console.warn(
          `Analysis document not found for threadId=${threadId}, messageId=${messageId}`
        );
        setAnalysis(null);
      }
    });

    return () => unsubscribe();
  }, [threadId, messageId]);

  if (!analysis) {
    return (
      <div>
        <h2>Intent Inspector</h2>
        <p>No analysis available for this message.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Intent Inspector</h2>
      <p>
        <strong>Primary Intent:</strong> {analysis.intent.primary} (
        {analysis.intent.confidence.toFixed(2)})
      </p>
      <p>
        <strong>All Intents:</strong> {analysis.intent.labels.join(', ')}
      </p>

      <h3>Skills</h3>
      <ul>
        {analysis.skills.items.map((skill) => (
          <li key={skill.id}>
            {skill.displayName || skill.id} – conf:{' '}
            {skill.confidence.toFixed(2)} (role: {skill.role ?? 'N/A'})
          </li>
        ))}
      </ul>

      <h3>Trajectory</h3>
      <p>
        <strong>Status:</strong> {analysis.trajectory.status}
      </p>
      <p>
        <strong>Current Nodes:</strong>{' '}
        {analysis.trajectory.currentNodes.join(', ')}
      </p>

      <h4>Suggested Next Nodes</h4>
      <ul>
        {analysis.trajectory.suggestedNextNodes.map((node, idx) => (
          <li key={idx}>
            {node.id} – priority: {node.priority ?? 'N/A'} – reason:{' '}
            {node.reason ?? 'N/A'}
          </li>
        ))}
      </ul>

      <h3>Metadata</h3>
      <p>Processed At: {analysis.metadata.processedAt}</p>
      <p>Model Version: {analysis.metadata.modelVersion}</p>
      <p>Thread ID: {analysis.metadata.threadId}</p>
      <p>Message ID: {analysis.metadata.messageId ?? 'N/A'}</p>
      <p>User ID: {analysis.metadata.uid}</p>
    </div>
  );
}
