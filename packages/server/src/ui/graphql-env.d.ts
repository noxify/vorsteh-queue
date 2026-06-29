/* eslint-disable */
/* prettier-ignore */

export type introspection_types = {
    'Boolean': unknown;
    'FlowEntry': { kind: 'OBJECT'; name: 'FlowEntry'; fields: { 'flowId': { name: 'flowId'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'rootJob': { name: 'rootJob'; type: { kind: 'OBJECT'; name: 'Job'; ofType: null; } }; }; };
    'FlowNode': { kind: 'OBJECT'; name: 'FlowNode'; fields: { 'children': { name: 'children'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'FlowNode'; ofType: null; }; }; } }; 'job': { name: 'job'; type: { kind: 'OBJECT'; name: 'Job'; ofType: null; } }; }; };
    'ID': unknown;
    'Int': unknown;
    'Job': { kind: 'OBJECT'; name: 'Job'; fields: { 'attempts': { name: 'attempts'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'cancellationReason': { name: 'cancellationReason'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'cancelledAt': { name: 'cancelledAt'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'completedAt': { name: 'completedAt'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'createdAt': { name: 'createdAt'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'cron': { name: 'cron'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'error': { name: 'error'; type: { kind: 'OBJECT'; name: 'SerializedError'; ofType: null; } }; 'failedAt': { name: 'failedAt'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'groupKey': { name: 'groupKey'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'id': { name: 'id'; type: { kind: 'SCALAR'; name: 'ID'; ofType: null; } }; 'maxAttempts': { name: 'maxAttempts'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'name': { name: 'name'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'payload': { name: 'payload'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'priority': { name: 'priority'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'processAt': { name: 'processAt'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'processedAt': { name: 'processedAt'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'progress': { name: 'progress'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'result': { name: 'result'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'status': { name: 'status'; type: { kind: 'ENUM'; name: 'JobStatus'; ofType: null; } }; 'uniqueKey': { name: 'uniqueKey'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; }; };
    'JobStatus': { name: 'JobStatus'; enumValues: 'cancelled' | 'completed' | 'dead' | 'delayed' | 'failed' | 'pending' | 'processing' | 'waiting_children'; };
    'Mutation': { kind: 'OBJECT'; name: 'Mutation'; fields: { 'cancelJob': { name: 'cancelJob'; type: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; } }; 'clearJobs': { name: 'clearJobs'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'deleteJob': { name: 'deleteJob'; type: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; } }; 'redriveAll': { name: 'redriveAll'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'redriveJob': { name: 'redriveJob'; type: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; } }; 'retryJob': { name: 'retryJob'; type: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; } }; 'runJobNow': { name: 'runJobNow'; type: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; } }; }; };
    'Query': { kind: 'OBJECT'; name: 'Query'; fields: { 'deadJobs': { name: 'deadJobs'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Job'; ofType: null; }; }; } }; 'flowTree': { name: 'flowTree'; type: { kind: 'OBJECT'; name: 'FlowNode'; ofType: null; } }; 'flows': { name: 'flows'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'FlowEntry'; ofType: null; }; }; } }; 'job': { name: 'job'; type: { kind: 'OBJECT'; name: 'Job'; ofType: null; } }; 'jobs': { name: 'jobs'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Job'; ofType: null; }; }; } }; 'size': { name: 'size'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'stats': { name: 'stats'; type: { kind: 'OBJECT'; name: 'QueueStats'; ofType: null; } }; }; };
    'QueueStats': { kind: 'OBJECT'; name: 'QueueStats'; fields: { 'cancelled': { name: 'cancelled'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'completed': { name: 'completed'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'dead': { name: 'dead'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'delayed': { name: 'delayed'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'failed': { name: 'failed'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'pending': { name: 'pending'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'processing': { name: 'processing'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; }; };
    'SerializedError': { kind: 'OBJECT'; name: 'SerializedError'; fields: { 'message': { name: 'message'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'name': { name: 'name'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'stack': { name: 'stack'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; }; };
    'String': unknown;
    'Subscription': { kind: 'OBJECT'; name: 'Subscription'; fields: { 'jobStatusChanged': { name: 'jobStatusChanged'; type: { kind: 'OBJECT'; name: 'Job'; ofType: null; } }; 'statsUpdated': { name: 'statsUpdated'; type: { kind: 'OBJECT'; name: 'QueueStats'; ofType: null; } }; }; };
};

/** An IntrospectionQuery representation of your schema.
 *
 * @remarks
 * This is an introspection of your schema saved as a file by GraphQLSP.
 * It will automatically be used by `gql.tada` to infer the types of your GraphQL documents.
 * If you need to reuse this data or update your `scalars`, update `tadaOutputLocation` to
 * instead save to a .ts instead of a .d.ts file.
 */
export type introspection = {
  name: never
  query: "Query"
  mutation: "Mutation"
  subscription: "Subscription"
  types: introspection_types
}

import * as gqlTada from "gql.tada"

declare module "gql.tada" {
  interface setupSchema {
    introspection: introspection
  }
}
