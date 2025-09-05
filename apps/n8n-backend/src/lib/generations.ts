import { prisma } from "./db.js";

export const getGenerations = async (userId: string) => {
  const generations = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      generations: true,
    },
  });
  if (!generations) {
    throw new Error("User not found");
  }
  const reset = await resetGenerations(userId);
  if (reset) {
    return {
      generations: 0,
      reset: true,
    };
  }
  return {
    generations: generations.generations,
    reset: false,
  };
};

export const incrementGenerations = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new Error("User not found");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { generations: user.generations + 1 },
  });
};

export const resetGenerations = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new Error("User not found");
  }

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const lastResetMonth = user.lastReset?.getMonth();
  const lastResetYear = user.lastReset?.getFullYear();

  // Check if it's the 1st day of the month and we haven't reset this month yet
  if (
    today.getDate() === 1 &&
    (lastResetMonth !== currentMonth || lastResetYear !== currentYear)
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        generations: 0,
        lastReset: today,
      },
    });
    return true; // Indicates that reset happened
  }

  return false; // No reset needed
};
