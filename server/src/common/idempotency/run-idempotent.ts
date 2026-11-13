/**
 * 写操作幂等：同一个幂等键只执行一次。
 *
 * 前端在打开表单时生成一个键，重试和连点都带同一个键。
 * - 第一次请求：在同一个事务里先写 IdempotencyRecord (主键冲突即说明执行过)，再执行业务，最后存下返回结果。
 * - 之后的请求：主键冲突 (P2002)，直接返回第一次的结果并带 replayed: true，业务不会再执行一次。
 * - 不带键：照常执行 (兼容小程序等老客户端)。
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

type Tx = Prisma.TransactionClient;

export async function runIdempotent<T extends object>(
  prisma: PrismaClient,
  scope: string,
  idempotencyKey: string | undefined | null,
  work: (tx: Tx) => Promise<T>,
): Promise<T & { replayed?: boolean }> {
  if (!idempotencyKey) return prisma.$transaction((tx) => work(tx));
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new BadRequestException('幂等键格式不正确');
  }

  const key = `${scope}:${idempotencyKey}`;
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.idempotencyRecord.create({ data: { key, scope } });
      const result = await work(tx);
      await tx.idempotencyRecord.update({ where: { key }, data: { result: JSON.stringify(result) } });
      return result;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
      if (record?.result) return { ...(JSON.parse(record.result) as T), replayed: true };
      throw new ConflictException('相同的操作正在处理中，请稍后刷新查看结果');
    }
    throw err;
  }
}
