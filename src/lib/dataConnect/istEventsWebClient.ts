// src/lib/dataConnect/istEventsWebClient.ts

"use server";

import { getApps, initializeApp } from "firebase/app";
import {
  getDataConnect,
  connectDataConnectEmulator,
  executeQuery,
} from "firebase/data-connect";
import {
  connectorConfig,
  istEventsByUserAndCourseRef,
} from "@dataconnect/generated";

type ListParams = {
  userId: string;
  courseId: string;
};

let dataConnectInstance: ReturnType<typeof getDataConnect> | null = null;

function getOrInitDataConnect() {
  if (dataConnectInstance) return dataConnectInstance;

  // Ensure there is a Firebase App
  if (getApps().length === 0) {
    // For emulator, projectId is usually enough
    initializeApp({
      projectId:
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "coursewise-f2421",
    });
  }

  const dc = getDataConnect(connectorConfig);

  // Connect to emulator in development
  if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true") {
    connectDataConnectEmulator(dc, "localhost", 9400);
  }

  dataConnectInstance = dc;
  return dc;
}

/**
 * Returns all IST events for a given userId + courseId from Data Connect
 */
export async function listIstEventsForUserAndCourse({
  userId,
  courseId,
}: ListParams) {
  const dc = getOrInitDataConnect();

  if (!dc) {
    console.warn("[DataConnect] client not initialized");
    return [];
  }

  const ref = istEventsByUserAndCourseRef(dc, { userId, courseId });
  const result = await executeQuery(ref);

  // Shape depends on schema – assuming result.data.istEvents
  return result.data?.istEvents ?? [];
}


