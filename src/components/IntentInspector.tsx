import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { MessageAnalysis } from '../../functions/src/types/messageAnalysis';

type IntentInspectorProps = {
  threadId: string;
  messageId: string;
};

export const IntentInspector: React.FC<IntentInspectorProps> = ({ threadId, messageId }) => {
  const [analysis, setAnalysis] = useState<MessageAnalysis | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'threads', threadId, 'analysis', messageId);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      setAnalysis(doc.data() as MessageAnalysis | null);
    });
    return () => unsubscribe();
  }, [threadId, messageId]);

  if (!analysis) {
    return <div>Loading analysis...</div>;
  }

  return (
    <div>
      <h2>Intent Inspector</h2>
      <p>Primary Intent: {analysis.intent.primary} (Confidence: {analysis.intent.confidence})</p>
      <p>All Intents: {analysis.intent.labels.join(', ')}</p>
      <h3>Skills</h3>
      <ul>
        {analysis.skills.items.map((skill) => (
          <li key={skill.id}>
            {skill.displayName || skill.id} (Confidence: {skill.confidence}, Role: {skill.role})
          </li>
        ))}
      </ul>
      <h3>Trajectory</h3>
      <p>Status: {analysis.trajectory.status}</p>
      <p>Current Nodes: {analysis.trajectory.currentNodes.join(', ')}</p>
      <h4>Suggested Next Nodes</h4>
      <ul>
        {analysis.trajectory.suggestedNextNodes.map((node) => (
          <li key={node.id}>
            {node.id} (Priority: {node.priority}, Reason: {node.reason})
          </li>
        ))}
      </ul>
    </div>
  );
};
