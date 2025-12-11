# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `coursewise-ist-connector`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*IstEventsByUserAndCourse*](#isteventsbyuserandcourse)
- [**Mutations**](#mutations)
  - [*CreateIstEvent*](#createistevent)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `coursewise-ist-connector`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `coursewise-ist-connector` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## IstEventsByUserAndCourse
You can execute the `IstEventsByUserAndCourse` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
istEventsByUserAndCourse(vars: IstEventsByUserAndCourseVariables): QueryPromise<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;

interface IstEventsByUserAndCourseRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: IstEventsByUserAndCourseVariables): QueryRef<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;
}
export const istEventsByUserAndCourseRef: IstEventsByUserAndCourseRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
istEventsByUserAndCourse(dc: DataConnect, vars: IstEventsByUserAndCourseVariables): QueryPromise<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;

interface IstEventsByUserAndCourseRef {
  ...
  (dc: DataConnect, vars: IstEventsByUserAndCourseVariables): QueryRef<IstEventsByUserAndCourseData, IstEventsByUserAndCourseVariables>;
}
export const istEventsByUserAndCourseRef: IstEventsByUserAndCourseRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the istEventsByUserAndCourseRef:
```typescript
const name = istEventsByUserAndCourseRef.operationName;
console.log(name);
```

### Variables
The `IstEventsByUserAndCourse` query requires an argument of type `IstEventsByUserAndCourseVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface IstEventsByUserAndCourseVariables {
  userId: string;
  courseId: string;
}
```
### Return Type
Recall that executing the `IstEventsByUserAndCourse` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `IstEventsByUserAndCourseData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `IstEventsByUserAndCourse`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, istEventsByUserAndCourse, IstEventsByUserAndCourseVariables } from '@dataconnect/generated';

// The `IstEventsByUserAndCourse` query requires an argument of type `IstEventsByUserAndCourseVariables`:
const istEventsByUserAndCourseVars: IstEventsByUserAndCourseVariables = {
  userId: ..., 
  courseId: ..., 
};

// Call the `istEventsByUserAndCourse()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await istEventsByUserAndCourse(istEventsByUserAndCourseVars);
// Variables can be defined inline as well.
const { data } = await istEventsByUserAndCourse({ userId: ..., courseId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await istEventsByUserAndCourse(dataConnect, istEventsByUserAndCourseVars);

console.log(data.istEvents);

// Or, you can use the `Promise` API.
istEventsByUserAndCourse(istEventsByUserAndCourseVars).then((response) => {
  const data = response.data;
  console.log(data.istEvents);
});
```

### Using `IstEventsByUserAndCourse`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, istEventsByUserAndCourseRef, IstEventsByUserAndCourseVariables } from '@dataconnect/generated';

// The `IstEventsByUserAndCourse` query requires an argument of type `IstEventsByUserAndCourseVariables`:
const istEventsByUserAndCourseVars: IstEventsByUserAndCourseVariables = {
  userId: ..., 
  courseId: ..., 
};

// Call the `istEventsByUserAndCourseRef()` function to get a reference to the query.
const ref = istEventsByUserAndCourseRef(istEventsByUserAndCourseVars);
// Variables can be defined inline as well.
const ref = istEventsByUserAndCourseRef({ userId: ..., courseId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = istEventsByUserAndCourseRef(dataConnect, istEventsByUserAndCourseVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.istEvents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.istEvents);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `coursewise-ist-connector` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateIstEvent
You can execute the `CreateIstEvent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createIstEvent(vars: CreateIstEventVariables): MutationPromise<CreateIstEventData, CreateIstEventVariables>;

interface CreateIstEventRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateIstEventVariables): MutationRef<CreateIstEventData, CreateIstEventVariables>;
}
export const createIstEventRef: CreateIstEventRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createIstEvent(dc: DataConnect, vars: CreateIstEventVariables): MutationPromise<CreateIstEventData, CreateIstEventVariables>;

interface CreateIstEventRef {
  ...
  (dc: DataConnect, vars: CreateIstEventVariables): MutationRef<CreateIstEventData, CreateIstEventVariables>;
}
export const createIstEventRef: CreateIstEventRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createIstEventRef:
```typescript
const name = createIstEventRef.operationName;
console.log(name);
```

### Variables
The `CreateIstEvent` mutation requires an argument of type `CreateIstEventVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `CreateIstEvent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateIstEventData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateIstEventData {
  istEvent_insert: IstEvent_Key;
}
```
### Using `CreateIstEvent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createIstEvent, CreateIstEventVariables } from '@dataconnect/generated';

// The `CreateIstEvent` mutation requires an argument of type `CreateIstEventVariables`:
const createIstEventVars: CreateIstEventVariables = {
  userId: ..., 
  courseId: ..., 
  threadId: ..., 
  messageId: ..., 
  utterance: ..., 
  intent: ..., 
  skills: ..., // optional
  trajectory: ..., // optional
};

// Call the `createIstEvent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createIstEvent(createIstEventVars);
// Variables can be defined inline as well.
const { data } = await createIstEvent({ userId: ..., courseId: ..., threadId: ..., messageId: ..., utterance: ..., intent: ..., skills: ..., trajectory: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createIstEvent(dataConnect, createIstEventVars);

console.log(data.istEvent_insert);

// Or, you can use the `Promise` API.
createIstEvent(createIstEventVars).then((response) => {
  const data = response.data;
  console.log(data.istEvent_insert);
});
```

### Using `CreateIstEvent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createIstEventRef, CreateIstEventVariables } from '@dataconnect/generated';

// The `CreateIstEvent` mutation requires an argument of type `CreateIstEventVariables`:
const createIstEventVars: CreateIstEventVariables = {
  userId: ..., 
  courseId: ..., 
  threadId: ..., 
  messageId: ..., 
  utterance: ..., 
  intent: ..., 
  skills: ..., // optional
  trajectory: ..., // optional
};

// Call the `createIstEventRef()` function to get a reference to the mutation.
const ref = createIstEventRef(createIstEventVars);
// Variables can be defined inline as well.
const ref = createIstEventRef({ userId: ..., courseId: ..., threadId: ..., messageId: ..., utterance: ..., intent: ..., skills: ..., trajectory: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createIstEventRef(dataConnect, createIstEventVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.istEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.istEvent_insert);
});
```

