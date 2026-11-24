/**
 * 清空业务数据（保留账号体系），用于重复执行 seed 前重置。
 * 用法：node --experimental-strip-types prisma/reset.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('清空演示数据…');
  await prisma.$transaction([
    prisma.pageView.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.visitSession.deleteMany(),
    prisma.listingImage.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.sourceCode.deleteMany(),
    prisma.agentProfile.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);
  // 只删演示员工/用户账号，保留可能由用户自己创建的账号
  await prisma.user.deleteMany({
    where: {
      phone: {
        in: [
          '13800000000',
          '13800000001',
          '13900000001',
          '13900000002',
          '13900000003',
          '13900000004',
          '13700000001',
          '13700000002',
          '13700000003',
        ],
      },
    },
  });
  console.log('已清空。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
