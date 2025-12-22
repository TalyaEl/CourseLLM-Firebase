import React from 'react';
import { IntentInspector } from '../components/IntentInspector';
import { analyzeMessageFn } from '../firebase';

const AnalysisDemo = () => {
    const [messageText, setMessageText] = React.useState('');
    const [analysis, setAnalysis] = React.useState<any>(null);
    const threadId = "demo-thread";
    const messageId = "demo-msg-1";

    const handleAnalyze = async () => {
        try {
            const result = await analyzeMessageFn({ 
                threadId, 
                messageId, 
                messageText, 
                courseId: "intro_probability", 
                language: "en" 
            });
            setAnalysis(result.data);
        } catch (error) {
            console.error("Error calling analyzeMessage function:", error);
        }
    };

    return (
        <div>
            <h1>Analysis Demo</h1>
            <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                cols={50}
            />
            <br />
            <button onClick={handleAnalyze}>Analyze</button>

            {analysis && (
                <div>
                    <h2>Raw JSON Response</h2>
                    <pre>{JSON.stringify(analysis, null, 2)}</pre>
                </div>
            )}

            <IntentInspector threadId={threadId} messageId={messageId} />
        </div>
    );
};

export default AnalysisDemo;
