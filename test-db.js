const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    const user = await prisma.user.findFirst()
    console.log('User found:', user ? 'Yes' : 'No')
    if (user) {
      console.log('planExpiresAt property:', user.planExpiresAt !== undefined ? 'Defined' : 'Undefined')
    }
  } catch (e) {
    console.error('Error during test:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
