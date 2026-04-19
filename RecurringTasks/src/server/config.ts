export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  generationSchedule: process.env.GENERATION_SCHEDULE || '0 1 * * *',
};
