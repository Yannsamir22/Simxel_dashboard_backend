// Generates a key in the format SIMXEL-XXXX-XXXX-XXXX
export const generateSecretKey = (): string => {
  const segment = () =>
    Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(4, "X");
  return `SIMXEL-${segment()}-${segment()}-${segment()}`;
};
