"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeMessage = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("./firebaseAdmin");
async function runIstAnalysis(input) {
    const now = new Date().toISOString();
    return {
        intent: {
            labels: ['ASK_EXPLANATION'],
            primary: 'ASK_EXPLANATION',
            confidence: 0.95,
        },
        skills: {
            items: [
                {
                    id: 'bayes-theorem',
                    displayName: 'Bayes Theorem',
                    confidence: 0.9,
                    role: 'FOCUS',
                },
                {
                    id: 'probability',
                    displayName: 'Probability',
                    confidence: 0.98,
                    role: 'PREREQUISITE',
                },
            ],
        },
        trajectory: {
            currentNodes: ['introduction-to-probability'],
            suggestedNextNodes: [
                {
                    id: 'bayes-theorem-explained',
                    reason: 'The user is asking a direct question about this topic.',
                    priority: 1,
                },
            ],
            status: 'ON_TRACK',
        },
        metadata: {
            processedAt: now,
            modelVersion: 'ist-v1',
            threadId: input.threadId,
            messageId: input.messageId,
            uid: input.uid,
        },
    };
}
exports.analyzeMessage = (0, https_1.onCall)(async (request) => {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to call analyzeMessage.');
    }
    const data = request.data;
    if (!data.threadId || !data.messageText) {
        throw new https_1.HttpsError('invalid-argument', 'threadId and messageText are required.');
    }
    const messageId = data.messageId || 'auto-generated';
    const analysis = await runIstAnalysis(Object.assign(Object.assign({}, data), { messageId, uid }));
    const db = (0, firebaseAdmin_1.getFirestore)();
    const ref = db
        .collection('threads')
        .doc(data.threadId)
        .collection('analysis')
        .doc(messageId);
    await ref.set(analysis, { merge: true });
    return analysis;
});
//# sourceMappingURL=analyzeMessage.js.map