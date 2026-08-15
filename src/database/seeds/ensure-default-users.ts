import { DataSource } from 'typeorm';
import { User, Sector } from '../../entities';
import { UserRole } from '../../common/enums';
import * as bcrypt from 'bcrypt';

export const LOCAL_DEV_PASSWORD = 'senha123';

const DEFAULT_SECTORS = [
  'ESGOTO',
  'AGUA',
  'REPOSICAO',
  'HIDROMETRIA',
  'DESOBSTRUCAO',
];

const DEFAULT_USERS: Array<{ name: string; email: string; role: UserRole }> = [
  { name: 'Administrador', email: 'admin@sanorte.com', role: UserRole.ADMIN },
  { name: 'Gestor', email: 'gestor@sanorte.com', role: UserRole.GESTOR },
  { name: 'Fiscal', email: 'fiscal@sanorte.com', role: UserRole.FISCAL },
  {
    name: 'Supervisor',
    email: 'supervisor@sanorte.com',
    role: UserRole.SUPERVISOR,
  },
];

export async function ensureDefaultUsersAndSectors(
  dataSource: DataSource,
  options: { resetAllPasswords?: boolean } = {},
): Promise<string> {
  const userRepository = dataSource.getRepository(User);
  const sectorRepository = dataSource.getRepository(Sector);
  const passwordHash = await bcrypt.hash(LOCAL_DEV_PASSWORD, 10);

  for (const sectorName of DEFAULT_SECTORS) {
    const existingSector = await sectorRepository.findOne({
      where: { name: sectorName },
    });
    if (!existingSector) {
      await sectorRepository.save(
        sectorRepository.create({
          name: sectorName,
          active: true,
        }),
      );
      console.log(`✓ Setor criado: ${sectorName}`);
    }
  }

  if (options.resetAllPasswords) {
    await dataSource.query('UPDATE users SET password_hash = $1', [
      passwordHash,
    ]);
    console.log(
      `✓ Senha local de todos os usuários redefinida para ${LOCAL_DEV_PASSWORD}`,
    );
  }

  for (const user of DEFAULT_USERS) {
    const existing = await userRepository.findOne({
      where: { email: user.email },
    });
    if (!existing) {
      await userRepository.save(
        userRepository.create({
          ...user,
          passwordHash,
        }),
      );
      console.log(`✓ ${user.role} criado: ${user.email} / ${LOCAL_DEV_PASSWORD}`);
      continue;
    }

    existing.passwordHash = passwordHash;
    await userRepository.save(existing);
    console.log(`✓ ${user.role} disponível: ${user.email} / ${LOCAL_DEV_PASSWORD}`);
  }

  await dataSource.query(`
    INSERT INTO user_contracts (user_id, contract_id)
    SELECT u.id, c.id
    FROM users u
    CROSS JOIN contracts c
    WHERE u.email = ANY($1)
    ON CONFLICT DO NOTHING
  `, [DEFAULT_USERS.map((user) => user.email)]);
  console.log('✓ Usuários padrão vinculados a todos os contratos');

  return passwordHash;
}
