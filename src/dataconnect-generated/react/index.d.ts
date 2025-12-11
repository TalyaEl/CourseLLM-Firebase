import { IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables, CreateIstEventData, CreateIstEventVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useIstEventsByUserAndCourse(vars: IstEventsByUserAndCourseVariables, options?: useDataConnectQueryOptions<IstEventsByUserAndCourseData>): UseDataConnectQueryResult<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;
export function useIstEventsByUserAndCourse(dc: DataConnect, vars: IstEventsByUserAndCourseVariables, options?: useDataConnectQueryOptions<IstEventsByUserAndCourseData>): UseDataConnectQueryResult<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;

export function useCreateIstEvent(options?: useDataConnectMutationOptions<CreateIstEventData, FirebaseError, CreateIstEventVariables>): UseDataConnectMutationResult<CreateIstEventData, CreateIstEventVariables>;
export function useCreateIstEvent(dc: DataConnect, options?: useDataConnectMutationOptions<CreateIstEventData, FirebaseError, CreateIstEventVariables>): UseDataConnectMutationResult<CreateIstEventData, CreateIstEventVariables>;
