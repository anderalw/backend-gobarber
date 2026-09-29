import AppError from '@shared/errors/AppError';
import FakeBlockReasonsRepository from '../repositories/fakes/FakeBlockReasonsRepository';
import BlockReasonsService from './BlockReasonsService';

let blockReasons: BlockReasonsService;

describe('BlockReasons', () => {
  beforeEach(() => {
    blockReasons = new BlockReasonsService(new FakeBlockReasonsRepository());
  });

  it('should create reasons and list them by name', async () => {
    await blockReasons.create('  Médico   e exames ');
    await blockReasons.create('Almoço');

    const names = (await blockReasons.list()).map(reason => reason.name);

    expect(names).toEqual(['Almoço', 'Médico e exames']);
  });

  it('should not repeat a name, ignoring case', async () => {
    await blockReasons.create('Almoço');

    await expect(blockReasons.create('almoço')).rejects.toMatchObject({
      message: 'Já existe um motivo com esse nome.',
    });
  });

  it('should require a name with a limited length', async () => {
    await expect(blockReasons.create('   ')).rejects.toBeInstanceOf(AppError);
    await expect(blockReasons.create('x'.repeat(41))).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('should rename a reason, keeping its own name allowed', async () => {
    const lunch = await blockReasons.create('Almoco');
    await blockReasons.create('Folga');

    const renamed = await blockReasons.update(lunch.id, 'Almoço');

    expect(renamed.name).toBe('Almoço');
    await expect(
      blockReasons.update(lunch.id, 'ALMOÇO'),
    ).resolves.toBeDefined();
    await expect(blockReasons.update(lunch.id, 'folga')).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('should delete a reason', async () => {
    const lunch = await blockReasons.create('Almoço');

    await blockReasons.delete(lunch.id);

    expect(await blockReasons.list()).toEqual([]);
    await expect(blockReasons.delete(lunch.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
