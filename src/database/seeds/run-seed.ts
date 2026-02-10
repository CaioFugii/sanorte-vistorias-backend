import { DataSource } from 'typeorm';
import { typeormConfig } from '../../config/typeorm.config';
import { User } from '../../entities';
import { UserRole, ModuleType } from '../../common/enums';
import * as bcrypt from 'bcrypt';

async function seed() {
  const dataSource = new DataSource(typeormConfig);
  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);

  // Criar usuários padrão
  const defaultPassword = 'senha123'; // Documentar no README
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const admin = userRepository.create({
    name: 'Administrador',
    email: 'admin@sanorte.com',
    passwordHash,
    role: UserRole.ADMIN,
  });

  const gestor = userRepository.create({
    name: 'Gestor',
    email: 'gestor@sanorte.com',
    passwordHash,
    role: UserRole.GESTOR,
  });

  const fiscal = userRepository.create({
    name: 'Fiscal',
    email: 'fiscal@sanorte.com',
    passwordHash,
    role: UserRole.FISCAL,
  });

  // Verificar se já existem
  const existingAdmin = await userRepository.findOne({
    where: { email: admin.email },
  });
  if (!existingAdmin) {
    await userRepository.save(admin);
    console.log('✓ Admin criado: admin@sanorte.com / senha123');
  }

  const existingGestor = await userRepository.findOne({
    where: { email: gestor.email },
  });
  if (!existingGestor) {
    await userRepository.save(gestor);
    console.log('✓ Gestor criado: gestor@sanorte.com / senha123');
  }

  const existingFiscal = await userRepository.findOne({
    where: { email: fiscal.email },
  });
  if (!existingFiscal) {
    await userRepository.save(fiscal);
    console.log('✓ Fiscal criado: fiscal@sanorte.com / senha123');
  }

  console.log('\nSeed concluído!');
  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('Erro ao executar seed:', error);
  process.exit(1);
});
