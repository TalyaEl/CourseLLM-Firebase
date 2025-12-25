"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeMessage = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("./firebaseAdmin");
const istContextFromJson_1 = require("./istContextFromJson");
const istContextFromDataConnect_1 = require("./istContextFromDataConnect");
const istEventsClient_1 = require("./dataconnect/istEventsClient");
/**
 * Call the DSPy microservice to extract real IST data.
 */
async function callDspyService(utterance, courseContext, chatHistory, istHistory) {
    var _a, _b, _c, _d, _e, _f;
    const dspyBaseUrl = (_a = process.env.DSPY_SERVICE_URL) !== null && _a !== void 0 ? _a : 'http://127.0.0.1:8000';
    const dspyUrl = `${dspyBaseUrl}/api/intent-skill-trajectory`;
    console.log('[analyzeMessage] Calling DSPy service at:', dspyUrl);
    if (istHistory && istHistory.length > 0) {
        console.log(`[analyzeMessage] Enriching DSPy request with ${istHistory.length} IST history items`);
    }
    if (chatHistory && chatHistory.length > 0) {
        console.log(`[analyzeMessage] Enriching DSPy request with ${chatHistory.length} chat history items`);
    }
    const response = await fetch(dspyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            utterance: utterance.trim(),
            course_context: courseContext !== null && courseContext !== void 0 ? courseContext : null,
            chat_history: chatHistory !== null && chatHistory !== void 0 ? chatHistory : [],
            ist_history: istHistory !== null && istHistory !== void 0 ? istHistory : [],
            student_profile: null,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DSPy service returned ${response.status}: ${errorText}`);
    }
    const data = (await response.json());
    console.log('[analyzeMessage] DSPy response received:', {
        intent: (_b = data.intent) === null || _b === void 0 ? void 0 : _b.substring(0, 50),
        skillsCount: (_d = (_c = data.skills) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0,
        trajectoryCount: (_f = (_e = data.trajectory) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0,
    });
    return data;
}
/**
 * Map DSPy IST response to MessageAnalysis format.
 */
function mapDspyToMessageAnalysis(dspyResponse, input) {
    var _a, _b, _c, _d;
    const now = new Date().toISOString();
    // Map intent string to IntentLabel (simplified mapping)
    // Try to infer intent from the string, default to ASK_EXPLANATION
    const intentLower = (_b = (_a = dspyResponse.intent) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : '';
    let primaryIntent = 'ASK_EXPLANATION';
    if (intentLower.includes('example') || intentLower.includes('demonstrate')) {
        primaryIntent = 'ASK_EXAMPLES';
    }
    else if (intentLower.includes('step') || intentLower.includes('how to')) {
        primaryIntent = 'ASK_STEP_BY_STEP_HELP';
    }
    else if (intentLower.includes('quiz') || intentLower.includes('test')) {
        primaryIntent = 'ASK_QUIZ';
    }
    else if (intentLower.includes('summary') || intentLower.includes('summarize')) {
        primaryIntent = 'ASK_SUMMARY';
    }
    else if (intentLower.includes('next') || intentLower.includes('what to learn')) {
        primaryIntent = 'ASK_WHAT_TO_LEARN_NEXT';
    }
    else if (intentLower.includes('help') || intentLower.includes('system')) {
        primaryIntent = 'META_SYSTEM_HELP';
    }
    else if (intentLower.includes('off topic') || intentLower.includes('unrelated')) {
        primaryIntent = 'OFF_TOPIC';
    }
    // Map skills array to MessageAnalysis skills.items format
    const skillsItems = ((_c = dspyResponse.skills) !== null && _c !== void 0 ? _c : []).map((skill, index) => ({
        id: skill.toLowerCase().replace(/\s+/g, '-'),
        displayName: skill,
        confidence: 0.8,
        role: index === 0 ? 'FOCUS' : 'SECONDARY',
    }));
    // Map trajectory array to MessageAnalysis trajectory format
    const suggestedNextNodes = ((_d = dspyResponse.trajectory) !== null && _d !== void 0 ? _d : []).map((step, index) => ({
        id: `step-${index + 1}`,
        reason: step,
        priority: index + 1,
    }));
    return {
        intent: {
            labels: [primaryIntent],
            primary: primaryIntent,
            confidence: 0.85, // Default confidence
        },
        skills: {
            items: skillsItems,
        },
        trajectory: {
            currentNodes: [],
            suggestedNextNodes,
            status: 'ON_TRACK', // Default status, can be enhanced based on analysis
        },
        metadata: {
            processedAt: now,
            modelVersion: 'ist-v1-dspy',
            threadId: input.threadId,
            messageId: input.messageId,
            uid: input.uid,
        },
    };
}
async function runIstAnalysis(input) {
    var _a, _b, _c;
    const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
    // Load IST context when running in emulator
    let chatHistory = [];
    let istHistory = [];
    if (isEmulator) {
        try {
            console.log('[analyzeMessage] Attempting to load IST context from Data Connect');
            const context = await (0, istContextFromDataConnect_1.loadIstContextFromDataConnect)({
                userId: input.uid,
                courseId: (_a = input.courseId) !== null && _a !== void 0 ? _a : undefined,
                maxHistory: 5,
            });
            chatHistory = context.chatHistory;
            istHistory = context.istHistory;
            console.log('[analyzeMessage] Loaded IST context from Data Connect, events:', istHistory.length);
        }
        catch (err) {
            console.warn('[analyzeMessage] Failed to load IST context from Data Connect, falling back to JSON:', err);
        }
        // If Data Connect returned no history, optionally fall back to JSON (for early runs)
        if (istHistory.length === 0) {
            try {
                console.log('[analyzeMessage] Falling back to JSON IST context loader');
                const context = await (0, istContextFromJson_1.loadIstContextFromJson)({
                    userId: input.uid,
                    courseId: (_b = input.courseId) !== null && _b !== void 0 ? _b : undefined,
                    maxHistory: 5,
                });
                chatHistory = context.chatHistory;
                istHistory = context.istHistory;
                console.log('[analyzeMessage] Loaded IST context from JSON, events:', istHistory.length);
            }
            catch (err) {
                // Log but don't fail - context loading is optional
                console.warn('[analyzeMessage] Failed to load IST context from JSON:', err);
            }
        }
    }
    // Call the real DSPy service with enriched context
    const dspyResponse = await callDspyService(input.messageText, input.courseId ? `Course: ${input.courseId}` : null, chatHistory, istHistory);
    // --- Non-blocking Data Connect Write (Best Effort) ---
    console.log('[analyzeMessage] About to save IST event to DataConnect for messageId', input.messageId);
    try {
        await (0, istEventsClient_1.saveIstEventToDataConnect)({
            userId: input.uid,
            courseId: (_c = input.courseId) !== null && _c !== void 0 ? _c : 'unknown-course',
            threadId: input.threadId,
            messageId: input.messageId,
            utterance: input.messageText,
            intent: dspyResponse.intent,
            skills: dspyResponse.skills,
            trajectory: dspyResponse.trajectory,
        });
        console.log('[analyzeMessage] DataConnect save completed for messageId', input.messageId);
    }
    catch (err) {
        console.error('[analyzeMessage] Non-fatal: failed to write IstEvent to DataConnect', err);
    }
    // -----------------------------------------------------
    // Map DSPy response to MessageAnalysis format
    return mapDspyToMessageAnalysis(dspyResponse, input);
}
exports.analyzeMessage = (0, https_1.onCall)({
    region: 'us-central1',
    timeoutSeconds: 180,
}, async (request) => {
    var _a, _b, _c;
    try {
        const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
        const uid = (_b = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid) !== null && _b !== void 0 ? _b : (isEmulator ? 'demo-user' : undefined);
        if (isEmulator && !((_c = request.auth) === null || _c === void 0 ? void 0 : _c.uid)) {
            console.log('[analyzeMessage] No auth in emulator, using demo UID "demo-user"');
        }
        if (!uid) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to call analyzeMessage.');
        }
        const data = request.data;
        if (!data || typeof data !== 'object') {
            throw new https_1.HttpsError('invalid-argument', 'Request data must be an object.');
        }
        if (!data.threadId || !data.messageText) {
            throw new https_1.HttpsError('invalid-argument', 'threadId and messageText are required.');
        }
        const messageId = data.messageId || 'auto-generated';
        console.log('[analyzeMessage] Running IST analysis for threadId:', data.threadId, 'messageId:', messageId);
        const analysis = await runIstAnalysis(Object.assign(Object.assign({}, data), { messageId, uid }));
        console.log('[analyzeMessage] IST analysis complete, writing to Firestore...');
        const db = (0, firebaseAdmin_1.getFirestore)();
        const ref = db
            .collection('threads')
            .doc(data.threadId)
            .collection('analysis')
            .doc(messageId);
        await ref.set(analysis, { merge: true });
        console.log('[analyzeMessage] Successfully wrote analysis to Firestore');
        return analysis;
    }
    catch (err) {
        console.error('[analyzeMessage] Unhandled error:', err);
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        throw new https_1.HttpsError('internal', (err === null || err === void 0 ? void 0 : err.message) || 'Internal error in analyzeMessage');
    }
});
//# sourceMappingURL=analyzeMessage.js.map