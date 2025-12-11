import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'coursewise-ist-connector',
  service: 'coursewise-ist-service',
  location: 'us-central1'
};

export const istEventsByUserAndCourseRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'IstEventsByUserAndCourse', inputVars);
}
istEventsByUserAndCourseRef.operationName = 'IstEventsByUserAndCourse';

export function istEventsByUserAndCourse(dcOrVars, vars) {
  return executeQuery(istEventsByUserAndCourseRef(dcOrVars, vars));
}

export const createIstEventRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateIstEvent', inputVars);
}
createIstEventRef.operationName = 'CreateIstEvent';

export function createIstEvent(dcOrVars, vars) {
  return executeMutation(createIstEventRef(dcOrVars, vars));
}

