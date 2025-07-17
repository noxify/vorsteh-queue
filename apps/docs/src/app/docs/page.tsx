import { TableOfContents } from "~/components/table-of-contents"

// Dummy data for Table of Contents
const dummyHeadings = [
  { id: "introduction", text: "Introduction", level: 2 },
  { id: "what-is-vorsteh-queue", text: "What is Vorsteh Queue?", level: 3 },
  { id: "why-use-it", text: "Why use it?", level: 3 },
  { id: "installation", text: "Installation", level: 2 },
  { id: "npm", text: "NPM", level: 3 },
  { id: "yarn", text: "Yarn", level: 3 },
  { id: "quickstart", text: "Quickstart", level: 2 },
  { id: "defining-jobs", text: "Defining Jobs", level: 3 },
  { id: "processing-jobs", text: "Processing Jobs", level: 3 },
  { id: "scheduling-jobs", text: "Scheduling Jobs", level: 3 },
  { id: "api-reference", text: "API Reference", level: 2 },
  { id: "queue-methods", text: "Queue Methods", level: 3 },
  { id: "job-properties", text: "Job Properties", level: 3 },
]

export default function DocsPage() {
  return (
    <div className="flex">
      <article className="prose dark:prose-invert text-dark-200 dark:text-dark-900 max-w-none flex-1">
        <h1 className="text-dark-200 dark:text-dark-900 mb-6 text-4xl font-bold">
          Vorsteh Queue Documentation
        </h1>
        <p className="text-fur-500 dark:text-dark-800 mb-8 text-lg">
          Welcome to the official documentation for Vorsteh Queue, your reliable and
          database-agnostic job queue engine.
        </p>

        <h2 id="introduction" className="text-dark-200 dark:text-dark-900 mb-4 text-3xl font-bold">
          Introduction
        </h2>
        <h3
          id="what-is-vorsteh-queue"
          className="text-dark-200 dark:text-dark-900 mb-3 text-2xl font-semibold"
        >
          What is Vorsteh Queue?
        </h3>
        <p className="text-fur-500 dark:text-dark-800 mb-4">
          Vorsteh Queue is a robust and flexible job queue solution designed for modern Node.js
          applications. It allows you to offload time-consuming tasks, schedule recurring jobs, and
          manage background processes efficiently, ensuring your main application remains responsive
          and performant. Unlike many other queue systems, Vorsteh Queue is built with a
          database-agnostic core, meaning it can seamlessly integrate with your existing database
          (like Prisma, Drizzle, TypeORM, or raw SQL) without requiring additional message brokers
          or complex infrastructure.
        </p>
        <h3
          id="why-use-it"
          className="text-dark-200 dark:text-dark-900 mb-3 text-2xl font-semibold"
        >
          Why use it?
        </h3>
        <ul className="text-fur-500 dark:text-dark-800 mb-8 list-inside list-disc">
          <li>**Database Agnostic**: Use your preferred database as the backend.</li>
          <li>**Reliable**: Built-in retry logic, dead-letter queues, and graceful shutdowns.</li>
          <li>
            **Developer Experience**: Intuitive API, TypeScript support, and clear documentation.
          </li>
          <li>**Scalable**: Designed for horizontal scaling across multiple instances.</li>
          <li>**Open Source**: Free to use and extend, backed by a growing community.</li>
        </ul>

        <h2 id="installation" className="text-dark-200 dark:text-dark-900 mb-4 text-3xl font-bold">
          Installation
        </h2>
        <p className="text-fur-500 dark:text-dark-800 mb-4">
          Getting started with Vorsteh Queue is straightforward. Choose your preferred package
          manager:
        </p>
        <h3 id="npm" className="text-dark-200 dark:text-dark-900 mb-3 text-2xl font-semibold">
          NPM
        </h3>
        <pre className="bg-dark-100 text-cream-50 mb-4 overflow-x-auto rounded-lg p-4 font-mono text-sm dark:bg-slate-900 dark:text-slate-100">
          <code>npm install vorsteh-queue</code>
        </pre>
        <h3 id="yarn" className="text-dark-200 dark:text-dark-900 mb-3 text-2xl font-semibold">
          Yarn
        </h3>
        <pre className="bg-dark-100 text-cream-50 mb-8 overflow-x-auto rounded-lg p-4 font-mono text-sm dark:bg-slate-900 dark:text-slate-100">
          <code>yarn add vorsteh-queue</code>
        </pre>

        <h2 id="quickstart" className="text-dark-200 dark:text-dark-900 mb-4 text-3xl font-bold">
          Quickstart
        </h2>
        <p className="text-fur-500 dark:text-dark-800 mb-4">
          Here's a quick example to get you up and running with your first job:
        </p>
        <h3
          id="defining-jobs"
          className="text-dark-200 dark:text-dark-900 mb-3 text-2xl font-semibold"
        >
          Defining Jobs
        </h3>
        <pre className="bg-dark-100 text-cream-50 mb-4 overflow-x-auto rounded-lg p-4 font-mono text-sm dark:bg-slate-900 dark:text-slate-100">
          {`// jobs/send-email.ts
import { Job } from 'vorsteh-queue';

interface EmailData {
  to: string;
  subject: string;
  body: string;
}

export const sendEmailJob: Job<EmailData> = {
  name: 'send-email',
  handler: async (data) => {
    console.log(\`Sending email to \${data.to} with subject: \${data.subject}\`);
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Email sent!');
  },
};`}
        </pre>
        <h3
          id="processing-jobs"
          className="text-dark-200 dark:text-dark-900 mb-3 text-2xl font-semibold"
        >
          Processing Jobs
        </h3>
        <pre className="bg-dark-100 text-cream-50 mb-4 overflow-x-auto rounded-lg p-4 font-mono text-sm dark:bg-slate-900 dark:text-slate-100">
          {`// worker.ts
import { VorstehQueue } from 'vorsteh-queue';
// import { PrismaClient } from '@prisma/client'; // In a real app, import and initialize your Prisma client here
// const prisma = new PrismaClient(); // In a real app, initialize your Prisma client here
import { sendEmailJob } from './jobs/send-email';

// const prisma = new PrismaClient();
const queue = new VorstehQueue({
  adapter: 'prisma',
  connection: null, //prisma,
});

queue.process(sendEmailJob.name, sendEmailJob.handler);

console.log('Worker started, processing jobs...');`}
        </pre>
        <h3
          id="scheduling-jobs"
          className="text-dark-200 dark:text-dark-900 mb-3 text-2xl font-semibold"
        >
          Scheduling Jobs
        </h3>
        <pre className="bg-dark-100 text-cream-50 mb-8 overflow-x-auto rounded-lg p-4 font-mono text-sm dark:bg-slate-900 dark:text-slate-100">
          {`// app.ts
import { VorstehQueue } from 'vorsteh-queue';
// import { PrismaClient } from '@prisma/client'; // In a real app, import and initialize your Prisma client here
// const prisma = new PrismaClient(); // In a real app, initialize your Prisma client here

// const prisma = new PrismaClient();
const queue = new VorstehQueue({
  adapter: 'prisma',
  connection: null, //prisma,
});

async function main() {
  // Add a one-time job
  await queue.add('send-email', {
    to: 'alice@example.com',
    subject: 'Welcome to Vorsteh Queue!',
    body: '...'
  });

  // Schedule a recurring job (every day at 9 AM)
  await queue.repeat('daily-report', { type: 'summary' }, { cron: '0 9 * * *' });

  // Schedule a job for a specific time
  const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  await queue.add('process-data', { userId: 123 }, { delay: futureDate });
}

main();`}
        </pre>

        <h2 id="api-reference" className="text-dark-200 dark:text-dark-900 mb-4 text-3xl font-bold">
          API Reference
        </h2>
        <h3
          id="queue-methods"
          className="text-dark-200 dark:text-dark-900 mb-3 text-2xl font-semibold"
        >
          VorstehQueue Methods
        </h3>
        <p className="text-fur-500 dark:text-dark-800 mb-4">
          The `VorstehQueue` class provides the following methods:
        </p>
        <ul className="text-fur-500 dark:text-dark-800 mb-8 list-inside list-disc">
          <li>
            `add(name: string, data: any, options?: AddOptions)`: Adds a new job to the queue.
          </li>
          <li>
            `process(name: string, handler: JobHandler)`: Registers a handler for a specific job
            type.
          </li>
          <li>
            `repeat(name: string, data: any, options: RepeatOptions)`: Schedules a recurring job.
          </li>
          <li>`remove(jobId: string)`: Removes a job from the queue.</li>
          <li>`getJob(jobId: string)`: Retrieves a job by its ID.</li>
        </ul>
        <h3
          id="job-properties"
          className="text-dark-200 dark:text-dark-900 mb-3 text-2xl font-semibold"
        >
          Job Properties
        </h3>
        <p className="text-fur-500 dark:text-dark-800 mb-4">
          A `Job` object passed to a handler has the following properties:
        </p>
        <ul className="text-fur-500 dark:text-dark-800 mb-8 list-inside list-disc">
          <li>`id: string`: Unique identifier for the job.</li>
          <li>`name: string`: The name of the job.</li>
          <li>`data: any`: The payload data for the job.</li>
          <li>`attempts: number`: Current attempt count for the job.</li>
          <li>`createdAt: Date`: Timestamp when the job was created.</li>
          <li>`processedAt?: Date`: Timestamp when the job was last processed.</li>
          <li>`failedAt?: Date`: Timestamp when the job last failed.</li>
        </ul>
      </article>
      <TableOfContents headings={dummyHeadings} />
    </div>
  )
}
