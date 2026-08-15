import { DataSource } from 'typeorm';
import { typeormConfig } from '../../config/typeorm.config';
import { ensureDefaultUsersAndSectors } from './ensure-default-users';

async function seed() {
  const dataSource = new DataSource(typeormConfig);
  await dataSource.initialize();

  await ensureDefaultUsersAndSectors(dataSource);

  console.log('\nSeed concluído!');
  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('Erro ao executar seed:', error);
  process.exit(1);
});
