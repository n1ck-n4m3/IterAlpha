import {readFile} from 'node:fs/promises';
import {trainingJobSchema} from '../lib/spider/decision-contract.ts';
try {
  if(!process.argv[2])throw new Error('Provide a training job specification path.');
  const job=trainingJobSchema.parse(JSON.parse(await readFile(process.argv[2],'utf8')));
  console.log(`Validated ${job.jobId}. No training was submitted or started.`);
}catch(error){console.error(error instanceof Error?error.message:'Invalid training job.');process.exitCode=1;}
