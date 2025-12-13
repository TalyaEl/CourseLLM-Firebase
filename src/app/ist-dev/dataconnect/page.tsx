"use client";

import React, { useState } from "react";
import { listIstEventsForUserAndCourse } from "@/lib/dataConnect/istEventsWebClient";

type IstEvent = {
  id: string;
  userId: string;
  courseId: string;
  threadId: string;
  messageId: string;
  utterance: string;
  intent: string;
  skills?: any;
  trajectory?: any;
  createdAt: string;
};

export default function IstDataconnectDebugPage() {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<IstEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleLoad(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const userId = (formData.get("userId") as string | null) ?? "demo-user";
    const courseId = (formData.get("courseId") as string | null) ?? "cs202";

    try {
      const data = await listIstEventsForUserAndCourse({ userId, courseId });
      // listIstEventsForUserAndCourse already returns an array of events
      setEvents(data);
    } catch (err: any) {
      console.error("Failed to load IST events from Data Connect", err);
      setError("Failed to load IST events from Data Connect. Check console/logs for details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">IST Events – Data Connect (Emulator)</h1>

      <form onSubmit={handleLoad} className="flex gap-2 items-center">
        <input
          type="text"
          name="userId"
          defaultValue="demo-user"
          placeholder="userId"
          className="border px-2 py-1 rounded text-black"
        />
        <input
          type="text"
          name="courseId"
          defaultValue="cs202"
          placeholder="courseId"
          className="border px-2 py-1 rounded text-black"
        />
        <button
          type="submit"
          className="px-3 py-1 border rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Loading..." : "Load IST Events"}
        </button>
      </form>

      {error && <p className="text-red-600">{error}</p>}

      <section className="mt-4 space-y-2">
        {events.length === 0 && !loading && <p>No IST events found.</p>}

        {events.map((e) => (
          <div key={e.id} className="border rounded p-3 bg-gray-50 dark:bg-gray-800">
            <div className="text-xs text-gray-500">
              {e.createdAt} · thread: {e.threadId} · msg: {e.messageId}
            </div>
            <div className="mt-1 font-semibold">Intent: {e.intent}</div>
            <div className="mt-1 text-sm mb-2">Utterance: {e.utterance}</div>
            
            {e.skills && Array.isArray(e.skills) && e.skills.length > 0 && (
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded">
                <strong className="text-xs uppercase text-gray-500">Skills:</strong>
                <ul className="list-disc ml-5 text-sm">
                  {e.skills.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {e.trajectory && Array.isArray(e.trajectory) && e.trajectory.length > 0 && (
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded">
                <strong className="text-xs uppercase text-gray-500">Trajectory:</strong>
                <ol className="list-decimal ml-5 text-sm">
                  {e.trajectory.map((step: string, idx: number) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
