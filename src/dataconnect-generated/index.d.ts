import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateIstEventData {
  istEvent_insert: IstEvent_Key;
}

export interface CreateIstEventVariables {
  userId: string;
  courseId: string;
  threadId: string;
  messageId: string;
  utterance: string;
  intent: string;
  skills?: unknown | null;
  trajectory?: unknown | null;
}

export interface IstEvent_Key {
  id: UUIDString;
  __typename?: 'IstEvent_Key';
}

export interface IstEventsByUserAndCourseData {
  istEvents: ({
    id: UUIDString;
    userId: string;
    courseId: string;
    threadId: string;
    messageId: string;
    utterance: string;
    intent: string;
    skills?: unknown | null;
    trajectory?: unknown | null;
    createdAt: TimestampString;
  } & IstEvent_Key)[];
}

export interface IstEventsByUserAndCourseVariables {
  userId: string;
  courseId: string;
}

interface IstEventsByUserAndCourseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: IstEventsByUserAndCourseVariables): QueryRef<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: IstEventsByUserAndCourseVariables): QueryRef<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;
  operationName: string;
}
export const istEventsByUserAndCourseRef: IstEventsByUserAndCourseRef;

export function istEventsByUserAndCourse(vars: IstEventsByUserAndCourseVariables): QueryPromise<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;
export function istEventsByUserAndCourse(dc: DataConnect, vars: IstEventsByUserAndCourseVariables): QueryPromise<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;

interface CreateIstEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateIstEventVariables): MutationRef<CreateIstEventData, CreateIstEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateIstEventVariables): MutationRef<CreateIstEventData, CreateIstEventVariables>;
  operationName: string;
}
export const createIstEventRef: CreateIstEventRef;

export function createIstEvent(vars: CreateIstEventVariables): MutationPromise<CreateIstEventData, CreateIstEventVariables>;
export function createIstEvent(dc: DataConnect, vars: CreateIstEventVariables): MutationPromise<CreateIstEventData, CreateIstEventVariables>;

