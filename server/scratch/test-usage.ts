import dotenv from 'dotenv';
dotenv.config();
import { connectDatabase } from '../src/database/connection.js';
import OrganizationRepository from '../src/modules/organizations/repositories/organization.repository.js';
import OrganizationService from '../src/modules/organizations/services/organization.service.js';

async function test() {
  await connectDatabase();
  const repo = new OrganizationRepository();
  const service = new OrganizationService(repo);
  const usage = await service.getOrganizationUsage('6aa9677b1726d6238365238c');
  console.log('TALNOVA DEV USAGE RESULT:');
  console.log('Kiosks Metric:', usage.metrics.kiosks);
  console.log('Warnings:', usage.warnings);
  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
