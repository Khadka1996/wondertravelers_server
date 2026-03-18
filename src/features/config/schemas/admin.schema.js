import { z } from 'zod';

const lockUserSchema = z.object({
	lock: z.boolean(),
	reason: z.string().max(500).optional(),
});

const forceLogoutSchema = z.object({
	clearDevices: z.boolean().optional(),
});

export const adminSchemas = {
	lockUserSchema,
	forceLogoutSchema,
};

